// Batched comment captures → bo_at_comments merge + count-delta refresh
// planning — PURE (no I/O), unit-tested (server-comments; paired with
// workflows-comments).
//
// The workflows backup task fetches record comments via the Airtable REST
// comments endpoint (spike-verified 2026-07-27, workflows-comments README) and
// streams batches to POST /api/internal/spaces/:spaceId/comments-sync during
// the fan-out. Before any fetch it POSTs the per-record commentCounts observed
// on the record-listing pass to …/comments-plan and fetches ONLY the records
// the plan marks `refresh` (design Decision 5 — count-delta skip, founder
// direction 2026-07-25). This module owns:
//   - the wire types of both bodies (single source for both repos),
//   - batch extraction/validation (malformed-entry leniency),
//   - the per-record diff (Decisions 2/3: update-in-place, soft deletion,
//     deletion scoped to `complete` record captures),
//   - the pure plan (observed vs stored active counts → refresh/zeroCandidates).
//
// The drizzle read/apply live in space-db-pg.ts (readCommentWorkingSet /
// applyCommentBatch / readActiveCommentCounts).

// ───────────────────────── wire types ─────────────────────────

/** Body of POST …/comments-sync — one streamed batch from the fan-out. */
export interface CommentsSyncBody {
  backupRunId: string;
  baseId: string;
  records: CommentRecordCapture[];
}

export interface CommentRecordCapture {
  recordId: string;
  tableId: string;
  /**
   * True ONLY when this record's comment pagination finished — enables the
   * per-record deletion rule (Decision 3). A zeroCandidate confirmation is an
   * empty `complete: true` capture (no fetch happened; the record was observed
   * with commentCount 0).
   */
  complete?: boolean;
  /** Raw Airtable comment objects, forwarded verbatim. */
  comments: unknown[];
}

/** Body of POST …/comments-plan — the observed commented subset of a run. */
export interface CommentsPlanBody {
  baseId: string;
  /** Records observed with commentCount metadata on the listing pass. */
  records: { recordId: string; commentCount: number }[];
}

// ───────────────────────── batch extraction ─────────────────────────

export interface ExtractedComment {
  commentId: string;
  text: string | null;
  author: unknown;
  airtableCreatedAt: Date | null;
  airtableLastUpdatedAt: Date | null;
  raw: unknown;
}

export interface ExtractedRecordCapture {
  recordId: string;
  tableId: string;
  complete: boolean;
  comments: ExtractedComment[];
}

export interface ExtractedBatch {
  records: ExtractedRecordCapture[];
  /** Record entries or comment entries dropped for malformed shape (counted, not fatal). */
  dropped: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const dateOrNull = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Extract a batch's records — lenient per entry (malformed record entries and
 * comment entries are dropped + counted, never fatal), strict on nothing: the
 * route validates the top-level body shape before calling this.
 */
export function extractCommentBatch(records: unknown[]): ExtractedBatch {
  const out: ExtractedRecordCapture[] = [];
  let dropped = 0;
  for (const entry of records) {
    if (
      !isRecord(entry) ||
      typeof entry.recordId !== "string" ||
      typeof entry.tableId !== "string" ||
      !Array.isArray(entry.comments)
    ) {
      dropped++;
      continue;
    }
    const comments: ExtractedComment[] = [];
    for (const c of entry.comments) {
      if (!isRecord(c) || typeof c.id !== "string") {
        dropped++;
        continue;
      }
      comments.push({
        commentId: c.id,
        text: typeof c.text === "string" ? c.text : null,
        author: isRecord(c.author) ? c.author : null,
        airtableCreatedAt: dateOrNull(c.createdTime),
        airtableLastUpdatedAt: dateOrNull(c.lastUpdatedTime),
        raw: c,
      });
    }
    out.push({
      recordId: entry.recordId,
      tableId: entry.tableId,
      complete: entry.complete === true,
      comments,
    });
  }
  return { records: out, dropped };
}

// ───────────────────────── per-record diff ─────────────────────────

/** What readCommentWorkingSet returns for the batch's record ids. */
export interface PriorComment {
  commentId: string;
  recordId: string;
  text: string | null;
  airtableLastUpdatedAt: Date | null;
  status: string; // active | deleted
}

export interface CommentUpsertOp {
  commentId: string;
  recordId: string;
  tableId: string;
  text: string | null;
  author: unknown;
  airtableCreatedAt: Date | null;
  airtableLastUpdatedAt: Date | null;
  raw: unknown;
}

export interface CommentDiffResult {
  /** Every captured comment — writer upserts by airtable_comment_id (resurrects deleted). */
  upserts: CommentUpsertOp[];
  /** Comment ids to flip to 'deleted' (absent from a `complete` record capture). */
  deletions: string[];
  /** Response accounting. */
  added: number;
  updated: number;
}

/**
 * Diff one batch against the prior rows of ITS record ids (Decision 3: the
 * batch's records define the whole scope — unvisited records are untouched by
 * construction because the caller only reads/writes the batch's record ids).
 * Edits = text or Airtable last-updated delta; a re-captured deleted id
 * resurrects (upsert sets status active); deletion only on `complete` records.
 */
export function diffCommentBatch(args: {
  batch: ExtractedBatch;
  prior: PriorComment[];
}): CommentDiffResult {
  const { batch, prior } = args;
  const priorById = new Map(prior.map((p) => [p.commentId, p]));

  const upserts: CommentUpsertOp[] = [];
  const deletions: string[] = [];
  let added = 0;
  let updated = 0;

  for (const rec of batch.records) {
    const capturedIds = new Set<string>();
    for (const c of rec.comments) {
      capturedIds.add(c.commentId);
      upserts.push({
        commentId: c.commentId,
        recordId: rec.recordId,
        tableId: rec.tableId,
        text: c.text,
        author: c.author,
        airtableCreatedAt: c.airtableCreatedAt,
        airtableLastUpdatedAt: c.airtableLastUpdatedAt,
        raw: c.raw,
      });
      const p = priorById.get(c.commentId);
      if (!p) {
        added++;
      } else if (
        p.status !== "active" ||
        p.text !== c.text ||
        (p.airtableLastUpdatedAt?.getTime() ?? null) !== (c.airtableLastUpdatedAt?.getTime() ?? null)
      ) {
        updated++;
      }
    }
    if (rec.complete) {
      for (const p of prior) {
        if (p.recordId !== rec.recordId) continue;
        if (p.status === "active" && !capturedIds.has(p.commentId)) {
          deletions.push(p.commentId);
        }
      }
    }
  }

  return { upserts, deletions, added, updated };
}

// ───────────────────────── count-delta plan ─────────────────────────

export interface CommentPlanResult {
  /** Records whose observed count differs from the stored active count — fetch these. */
  refresh: string[];
  /**
   * Records holding stored active comments that are ABSENT from the observed
   * commented set. Workflows confirms each one it actually saw listed with
   * commentCount 0 via an empty `complete: true` capture (no fetch); candidates
   * it did not see listed are left alone (deleted/unvisited records — not this
   * feature's job).
   */
  zeroCandidates: string[];
}

/**
 * The count-delta skip (design Decision 5): equal counts are excluded — the
 * documented blind spot (same-count delete+add pairs and comment edits surface
 * only when the record's count next changes; founder-approved trade-off).
 */
export function planCommentRefresh(args: {
  observed: { recordId: string; commentCount: number }[];
  /** recordId → stored active-comment count (grouped over bo_at_comments). */
  storedActiveCounts: Map<string, number>;
}): CommentPlanResult {
  const { observed, storedActiveCounts } = args;
  const observedIds = new Set(observed.map((o) => o.recordId));

  const refresh: string[] = [];
  for (const o of observed) {
    const stored = storedActiveCounts.get(o.recordId) ?? 0;
    if (stored !== o.commentCount) refresh.push(o.recordId);
  }

  const zeroCandidates: string[] = [];
  for (const [recordId, count] of storedActiveCounts) {
    if (count > 0 && !observedIds.has(recordId)) zeroCandidates.push(recordId);
  }
  zeroCandidates.sort();

  return { refresh, zeroCandidates };
}
