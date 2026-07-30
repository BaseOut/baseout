// Airtable record-comments fetcher (workflows-comments task 2.1).
//
// GET /v0/{baseId}/{tableId}/{recordId}/comments — spike-verified 2026-07-27
// (openspec/changes/workflows-comments/README.md): the endpoint answers the
// existing `data.recordComments:read` grant with `{ comments: [], offset }`
// and paginates via the offset cursor (null on the final page).
//
// Pacing mirrors the airtable-client conventions (same per-base ~5 rps
// budget): 3 total attempts on 429/5xx, Retry-After honored when present,
// exponential backoff (200ms × 4^attempt) otherwise, non-retriable 4xx
// surfaces immediately. Comments are forwarded VERBATIM — the engine's
// comments-sync owns extraction and tolerance
// (apps/server/src/lib/per-space/comments-sync.ts).
//
// Failure isolation contract (workflows-comments spec): this function NEVER
// throws — every failure maps to `{ ok: false, reason }`, and a mid-pagination
// failure loses the WHOLE record (no partial ok), so the capture step only
// ever delivers records whose pagination finished (`complete: true`).

const AIRTABLE_BASE_URL = "https://api.airtable.com";
const DEFAULT_PAGE_SIZE = 100;

// Same pacing constants as _lib/airtable-client.ts (kept local — the client's
// constants are private and the comments endpoint is not part of its surface).
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 200;
const BACKOFF_GROWTH = 4;

export type FetchRecordCommentsReason =
  | "transport"
  | "invalid_response"
  | `http_${number}`;

export type FetchRecordCommentsResult =
  | { ok: true; comments: unknown[] }
  | { ok: false; reason: FetchRecordCommentsReason };

/**
 * One record's comment capture on a comments-sync batch (workflows-comments).
 * MIRROR of the canonical `CommentRecordCapture` in
 * apps/server/src/lib/per-space/comments-sync.ts (server-comments owns it) —
 * do not import across apps. `complete: true` ONLY when the record's comment
 * pagination finished (enables the server's per-record deletion rule); a
 * zero-candidate confirmation is an empty `complete: true` capture.
 */
export interface CommentRecordCaptureWire {
  recordId: string;
  tableId: string;
  complete?: boolean;
  /** Raw Airtable comment objects, forwarded verbatim. */
  comments: unknown[];
}

export const COMMENT_BATCH_MAX_RECORDS = 50;
export const COMMENT_BATCH_MAX_COMMENTS = 500;

export interface FetchRecordCommentsArgs {
  baseId: string;
  tableId: string;
  recordId: string;
  /** Decrypted Airtable OAuth access token. */
  accessToken: string;
  /** Test seam — defaults to global fetch in production. */
  fetchImpl?: typeof fetch;
  /** Test seam — defaults to setTimeout-based sleep in production. */
  sleepImpl?: (ms: number) => Promise<void>;
}

interface CommentsPage {
  comments?: unknown;
  offset?: unknown;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function isRetriable(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
}

/**
 * Fetch EVERY comment on one record, following the offset cursor to
 * completion. Resolves ok only when the full pagination succeeded.
 */
export async function fetchRecordComments(
  args: FetchRecordCommentsArgs,
): Promise<FetchRecordCommentsResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const sleep = args.sleepImpl ?? defaultSleep;
  const headers = {
    authorization: `Bearer ${args.accessToken}`,
    accept: "application/json",
  };
  const endpoint = `${AIRTABLE_BASE_URL}/v0/${encodeURIComponent(args.baseId)}/${encodeURIComponent(
    args.tableId,
  )}/${encodeURIComponent(args.recordId)}/comments`;

  // Retry-aware GET, mirroring airtable-client's getJson — but mapping every
  // failure to a result instead of throwing.
  async function getPage(
    url: string,
  ): Promise<{ ok: true; page: CommentsPage } | { ok: false; reason: FetchRecordCommentsReason }> {
    let lastStatus = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let res: Response;
      try {
        res = await fetchImpl(url, { headers });
      } catch {
        return { ok: false, reason: "transport" };
      }
      if (res.ok) {
        try {
          return { ok: true, page: (await res.json()) as CommentsPage };
        } catch {
          return { ok: false, reason: "invalid_response" };
        }
      }

      lastStatus = res.status;
      await res.text().catch(() => {});

      if (!isRetriable(res.status) || attempt === MAX_ATTEMPTS - 1) break;

      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
      const waitMs = retryAfterMs ?? BACKOFF_BASE_MS * BACKOFF_GROWTH ** attempt;
      await sleep(waitMs);
    }
    return { ok: false, reason: `http_${lastStatus}` };
  }

  const comments: unknown[] = [];
  let offset: string | undefined = undefined;
  for (;;) {
    const params = new URLSearchParams();
    params.set("pageSize", String(DEFAULT_PAGE_SIZE));
    if (offset) params.set("offset", offset);
    const result = await getPage(`${endpoint}?${params.toString()}`);
    if (!result.ok) return result;
    if (!Array.isArray(result.page.comments)) {
      return { ok: false, reason: "invalid_response" };
    }
    comments.push(...result.page.comments);
    offset = typeof result.page.offset === "string" && result.page.offset ? result.page.offset : undefined;
    if (!offset) break;
  }
  return { ok: true, comments };
}

// ── Shared fetch → batch → flush fan-out ─────────────────────────────────────

export interface CommentCaptureRecordRef {
  recordId: string;
  tableId: string;
}

export type CommentCaptureFanoutOutcome =
  | { status: "captured"; records: number; comments: number }
  | { status: "partial"; reason: string; records: number; comments: number };

export interface CaptureCommentsForRecordsArgs {
  /** Records whose comments to fetch (pagination to completion, per record). */
  toFetch: CommentCaptureRecordRef[];
  /** Pre-built captures that ride the FIRST batch (e.g. the full run's
   *  zero-candidate confirmations). Counted as delivered records, not
   *  delivered comments. */
  seed?: CommentRecordCaptureWire[];
  fetchComments: (ref: CommentCaptureRecordRef) => Promise<FetchRecordCommentsResult>;
  /** One streamed batch to the engine's comments-sync route. Throws on engine
   *  errors — mapped to `partial`, never thrown out of this helper. */
  syncComments: (records: CommentRecordCaptureWire[]) => Promise<void>;
}

/**
 * The streamed comment fan-out (workflows-comments design Decision 2),
 * shared by the full-backup capture step (which plans first) and the
 * incremental capture step (whose visited set IS the refresh list — task
 * 3.5). Fetches each record's comments to pagination completion, streams
 * batches to comments-sync as it goes, and marks records `complete: true`
 * only when their pagination finished. Never throws.
 *
 * Mid-fan-out failure flushes the already-finished records best-effort and
 * reports `partial` — delivered counts only reflect successful sync POSTs.
 */
export async function captureCommentsForRecords(
  args: CaptureCommentsForRecordsArgs,
): Promise<CommentCaptureFanoutOutcome> {
  let batch: CommentRecordCaptureWire[] = [...(args.seed ?? [])];
  let batchComments = 0;
  let deliveredRecords = 0;
  let deliveredComments = 0;

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const records = batch;
    const commentsInBatch = batchComments;
    batch = [];
    batchComments = 0;
    await args.syncComments(records);
    deliveredRecords += records.length;
    deliveredComments += commentsInBatch;
  };

  try {
    for (const ref of args.toFetch) {
      let fetched: FetchRecordCommentsResult;
      try {
        fetched = await args.fetchComments(ref);
      } catch {
        fetched = { ok: false, reason: "transport" };
      }
      if (!fetched.ok) {
        // Deliver the already-finished records best-effort, then report
        // honestly: records whose pagination didn't finish are never sent.
        try {
          await flush();
        } catch {
          // swallow — partial is partial either way
        }
        return {
          status: "partial",
          reason: fetched.reason,
          records: deliveredRecords,
          comments: deliveredComments,
        };
      }
      batch.push({
        recordId: ref.recordId,
        tableId: ref.tableId,
        complete: true,
        comments: fetched.comments,
      });
      batchComments += fetched.comments.length;
      if (
        batch.length >= COMMENT_BATCH_MAX_RECORDS ||
        batchComments >= COMMENT_BATCH_MAX_COMMENTS
      ) {
        await flush();
      }
    }
    await flush();
  } catch {
    // comments-sync failure — records already delivered stay delivered.
    return {
      status: "partial",
      reason: "sync_failed",
      records: deliveredRecords,
      comments: deliveredComments,
    };
  }
  return { status: "captured", records: deliveredRecords, comments: deliveredComments };
}
