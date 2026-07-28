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
