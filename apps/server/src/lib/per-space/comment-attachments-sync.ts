// Comment-attachment extraction + diff — PURE (no I/O), unit-tested
// (server-comment-attachments; paired with workflows-comment-attachments).
//
// Runs inside comments-sync persistence: the same raw Airtable comment objects
// that server-comments persists carry an optional `attachments` array whose URLs
// expire ~2h after issuance. This module:
//   - extracts attachment references from those comment payloads,
//   - diffs them against prior bo_at_comment_attachments rows (register-first:
//     new refs become `pending`; ready/uploaded rows are never regressed;
//     absent-from-a-complete-recapture rows soft-delete),
//   - produces the pending set the sync response returns so the in-flight
//     workflows task downloads while URLs are live (design Decision 2).
//
// The drizzle read/apply live in space-db-pg.ts (readCommentAttachmentWorkingSet
// / applyCommentAttachmentBatch / readStuckCommentAttachmentRecords).

// ───────────────────────── wire types ─────────────────────────

/**
 * One pending attachment in the comments-sync response — enough for the capture
 * task to download while the URL is live. `commentAttachmentId` is the stable
 * `${commentId}:${attachmentId}` identity.
 */
export interface PendingCommentAttachment {
  commentAttachmentId: string;
  commentId: string;
  recordId: string;
  url: string;
  filename: string;
}

// ───────────────────────── extraction ─────────────────────────

export interface ExtractedCommentAttachment {
  commentId: string;
  attachmentId: string;
  recordId: string;
  tableId: string;
  filename: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface ExtractedCommentAttachments {
  attachments: ExtractedCommentAttachment[];
  /** Comment ids observed inside a `complete` record capture — the deletion scope. */
  completeComments: string[];
  /** Attachment entries dropped for malformed shape (counted, not fatal). */
  dropped: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Walk the same record→comments→attachments shape comments-sync receives.
 * Lenient per attachment entry: `id`, `filename`, `url` are required strings;
 * anything else is dropped + counted. `type`→mimeType, `size`→sizeBytes;
 * width/height/thumbnails are derived metadata and not stored (design §payload).
 */
export function extractCommentAttachments(records: unknown[]): ExtractedCommentAttachments {
  const attachments: ExtractedCommentAttachment[] = [];
  const completeComments = new Set<string>();
  let dropped = 0;

  for (const entry of records) {
    if (!isRecord(entry) || typeof entry.recordId !== "string" || !Array.isArray(entry.comments)) {
      continue;
    }
    const recordId = entry.recordId;
    const tableId = typeof entry.tableId === "string" ? entry.tableId : "";
    const complete = entry.complete === true;

    for (const c of entry.comments) {
      if (!isRecord(c) || typeof c.id !== "string") continue;
      if (complete) completeComments.add(c.id);
      if (!Array.isArray(c.attachments)) continue;
      for (const a of c.attachments) {
        if (
          !isRecord(a) ||
          typeof a.id !== "string" ||
          typeof a.filename !== "string" ||
          typeof a.url !== "string"
        ) {
          dropped++;
          continue;
        }
        attachments.push({
          commentId: c.id,
          attachmentId: a.id,
          recordId,
          tableId,
          filename: a.filename,
          url: a.url,
          mimeType: typeof a.type === "string" ? a.type : null,
          sizeBytes: typeof a.size === "number" ? a.size : null,
        });
      }
    }
  }

  return { attachments, completeComments: [...completeComments], dropped };
}

// ───────────────────────── diff ─────────────────────────

export interface PriorCommentAttachment {
  commentId: string;
  attachmentId: string;
  recordId: string;
  uploadStatus: string; // pending | ready | uploaded
  status: string; // active | deleted
}

export interface CommentAttachmentUpsertOp {
  commentId: string;
  attachmentId: string;
  recordId: string;
  tableId: string;
  filename: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** On conflict, force upload_status back to 'pending' (resurrected deleted row → re-download). */
  regressUploadStatus: boolean;
}

export interface CommentAttachmentDiffResult {
  upserts: CommentAttachmentUpsertOp[];
  /** `${commentId}:${attachmentId}` identities to soft-delete. */
  deletions: string[];
  /** Attachments still needing a download — excludes prior ready/uploaded rows. */
  pendingSet: PendingCommentAttachment[];
}

const idOf = (commentId: string, attachmentId: string) => `${commentId}:${attachmentId}`;

/**
 * Diff extracted comment attachments against prior rows. Upserts every observed
 * attachment (bumps seen stamps + URL); a row already `ready`/`uploaded` is not
 * regressed and stays out of the pending set. Deletion is scoped to comments
 * observed in a `complete` record capture — a prior attachment of such a comment
 * that is no longer listed flips to `deleted` (bytes retained).
 */
export function diffCommentAttachments(args: {
  extracted: ExtractedCommentAttachments;
  prior: PriorCommentAttachment[];
}): CommentAttachmentDiffResult {
  const { extracted, prior } = args;
  const priorById = new Map(prior.map((p) => [idOf(p.commentId, p.attachmentId), p]));
  const completeComments = new Set(extracted.completeComments);

  const upserts: CommentAttachmentUpsertOp[] = [];
  const pendingSet: PendingCommentAttachment[] = [];
  const observed = new Set<string>();

  for (const a of extracted.attachments) {
    const key = idOf(a.commentId, a.attachmentId);
    observed.add(key);
    const p = priorById.get(key);
    const resurrecting = p?.status === "deleted";
    upserts.push({
      commentId: a.commentId,
      attachmentId: a.attachmentId,
      recordId: a.recordId,
      tableId: a.tableId,
      filename: a.filename,
      url: a.url,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      regressUploadStatus: resurrecting,
    });
    // Already staged/uploaded (and not resurrecting) → no download needed.
    const alreadyDone = !resurrecting && (p?.uploadStatus === "ready" || p?.uploadStatus === "uploaded");
    if (!alreadyDone) {
      pendingSet.push({
        commentAttachmentId: key,
        commentId: a.commentId,
        recordId: a.recordId,
        url: a.url,
        filename: a.filename,
      });
    }
  }

  const deletions: string[] = [];
  for (const p of prior) {
    if (p.status !== "active") continue;
    if (!completeComments.has(p.commentId)) continue; // only comments we fully re-saw
    const key = idOf(p.commentId, p.attachmentId);
    if (!observed.has(key)) deletions.push(key);
  }

  return { upserts, deletions, pendingSet };
}
