// POST /api/internal/attachments/lookup   — dedup read
// POST /api/internal/attachments/record   — dedup upsert
//
// Filed by openspec/changes/server-attachments; cut over to the per-Space DB by
// system-per-space-db §3.4. Attachment dedup metadata now lives in the per-Space
// `bo_at_attachments` (keyed by composite_id; PRD §2.8), NOT the master
// `attachment_dedup`. The workflows downloader (Node-only) hits these to:
//   1. lookup: which composite IDs are already persisted (+ storage key + status).
//   2. record: upsert rows after streaming a miss to the StorageWriter.
//
// Both resolve the Space's per-Space DB and run inside a transaction-scoped
// search_path (managed_pg). A Space whose per-Space DB isn't provisioned/active
// → 409; a non-managed_pg backend → 501. The downloader degrades gracefully on
// both (no-dedup; bytes still land at the destination). `storage_key` is
// destination-agnostic. Token gate is applied by middleware.

import { and, eq, inArray, sql } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type UploadStatus = "ready" | "uploaded";

// server-comment-attachments Decision 4: the same lookup/record endpoints serve
// comment-sourced attachments (keyed by the `${commentId}:${attachmentId}`
// commentAttachmentId, in bo_at_comment_attachments) behind a `source:'comment'`
// discriminator. A missing/`'field'` source keeps the composite-id field path.
type Source = "field" | "comment";

const parseSource = (v: unknown): Source | null => {
  if (v === undefined || v === "field") return "field";
  if (v === "comment") return "comment";
  return null;
};

/** Split a `${commentId}:${attachmentId}` key; ids carry no colons. */
function splitCommentKey(key: string): { commentId: string; attachmentId: string } | null {
  const sep = key.indexOf(":");
  if (sep <= 0 || sep >= key.length - 1) return null;
  return { commentId: key.slice(0, sep), attachmentId: key.slice(sep + 1) };
}

interface CommentRecordEntry {
  commentAttachmentId: string; // `${commentId}:${attachmentId}`
  storageKey: string;
  sizeBytes?: number;
  mimeType?: string;
  contentHash?: string;
  filename?: string;
  uploadStatus?: UploadStatus;
}

function isCommentRecordEntry(v: unknown): v is CommentRecordEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  if (typeof e.commentAttachmentId !== "string" || !splitCommentKey(e.commentAttachmentId)) return false;
  if (typeof e.storageKey !== "string" || e.storageKey.length === 0) return false;
  if (e.sizeBytes !== undefined && typeof e.sizeBytes !== "number") return false;
  if (e.mimeType !== undefined && typeof e.mimeType !== "string") return false;
  if (e.contentHash !== undefined && typeof e.contentHash !== "string") return false;
  if (e.filename !== undefined && typeof e.filename !== "string") return false;
  if (e.uploadStatus !== undefined && e.uploadStatus !== "ready" && e.uploadStatus !== "uploaded") {
    return false;
  }
  return true;
}

interface RecordEntry {
  compositeId: string;
  tableId: string;
  fieldId: string;
  recordId: string;
  storageKey: string;
  sizeBytes?: number;
  mimeType?: string;
  contentHash?: string;
  filename?: string;
  uploadStatus?: UploadStatus;
}

function isRecordEntry(v: unknown): v is RecordEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  for (const k of ["compositeId", "tableId", "fieldId", "recordId", "storageKey"]) {
    if (typeof e[k] !== "string" || (e[k] as string).length === 0) return false;
  }
  if (e.sizeBytes !== undefined && typeof e.sizeBytes !== "number") return false;
  if (e.mimeType !== undefined && typeof e.mimeType !== "string") return false;
  if (e.contentHash !== undefined && typeof e.contentHash !== "string") return false;
  if (e.filename !== undefined && typeof e.filename !== "string") return false;
  if (e.uploadStatus !== undefined && e.uploadStatus !== "ready" && e.uploadStatus !== "uploaded") {
    return false;
  }
  return true;
}

/** Resolve the Space's per-Space DB or a 409/501 response. */
async function resolveOrError(
  locals: AppLocals,
  spaceId: string,
): Promise<{ pgLocator: string } | { res: Response }> {
  const { db } = locals.getMasterDb();
  const space = await resolveSpaceDb(db, spaceId);
  if (!space || space.status !== "active") {
    return { res: jsonResponse({ error: "space_db_not_ready" }, 409) };
  }
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return { res: jsonResponse({ error: "backend_not_implemented" }, 501) };
  }
  return { pgLocator: space.pgLocator };
}

export async function attachmentsLookupHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const spaceId = (body as { spaceId?: unknown })?.spaceId;
  const source = parseSource((body as { source?: unknown })?.source);
  if (source === null) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof spaceId !== "string" || !UUID_RE.test(spaceId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // Comment-sourced lookup: keys are commentAttachmentIds; hits are rows already
  // written (storage_key present) so the downloader short-circuits.
  if (source === "comment") {
    const keys = (body as { keys?: unknown })?.keys;
    if (!Array.isArray(keys) || keys.some((k) => typeof k !== "string")) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    if (keys.length === 0) return jsonResponse({ hits: {} }, 200);
    const parsed = (keys as string[])
      .map((k) => ({ key: k, ...splitCommentKey(k) }))
      .filter((p): p is { key: string; commentId: string; attachmentId: string } => p.commentId != null);
    if (parsed.length === 0) return jsonResponse({ hits: {} }, 200);

    const resolved = await resolveOrError(locals, spaceId);
    if ("res" in resolved) return resolved.res;
    const { db } = locals.getMasterDb();
    const commentIds = [...new Set(parsed.map((p) => p.commentId))];

    const hits = await withSpaceSchema(db, resolved.pgLocator, async (tx) => {
      const rows = await tx
        .select({
          commentId: spacePg.commentAttachments.airtableCommentId,
          attachmentId: spacePg.commentAttachments.airtableAttachmentId,
          storageKey: spacePg.commentAttachments.storageKey,
          uploadStatus: spacePg.commentAttachments.uploadStatus,
          contentHash: spacePg.commentAttachments.contentHash,
        })
        .from(spacePg.commentAttachments)
        .where(inArray(spacePg.commentAttachments.airtableCommentId, commentIds));
      const wanted = new Set(parsed.map((p) => p.key));
      const h: Record<string, { storageKey: string; uploadStatus: string; contentHash?: string }> = {};
      for (const r of rows) {
        const key = `${r.commentId}:${r.attachmentId}`;
        // Only already-written rows are hits (pending rows have no storage_key).
        if (!wanted.has(key) || !r.storageKey) continue;
        h[key] = {
          storageKey: r.storageKey,
          uploadStatus: r.uploadStatus,
          ...(r.contentHash ? { contentHash: r.contentHash } : {}),
        };
      }
      return h;
    });
    return jsonResponse({ hits }, 200);
  }

  const compositeIds = (body as { compositeIds?: unknown })?.compositeIds;
  if (!Array.isArray(compositeIds) || compositeIds.some((c) => typeof c !== "string")) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (compositeIds.length === 0) {
    return jsonResponse({ hits: {} }, 200);
  }

  const resolved = await resolveOrError(locals, spaceId);
  if ("res" in resolved) return resolved.res;
  const { db } = locals.getMasterDb();

  const hits = await withSpaceSchema(db, resolved.pgLocator, async (tx) => {
    const rows = await tx
      .select({
        compositeId: spacePg.attachments.compositeId,
        storageKey: spacePg.attachments.storageKey,
        uploadStatus: spacePg.attachments.uploadStatus,
        contentHash: spacePg.attachments.contentHash,
      })
      .from(spacePg.attachments)
      .where(inArray(spacePg.attachments.compositeId, compositeIds as string[]));
    // contentHash rides along ADDITIVELY (workflows-media-metadata follow-up):
    // without it, dedup-skipped attachments had no content identity in hand and
    // the media index fell back to `att:<id>` surrogate checksums. Rows written
    // before hash stamping (2026-07-27) have NULL — the field stays optional.
    const h: Record<string, { storageKey: string; uploadStatus: string; contentHash?: string }> = {};
    for (const r of rows) {
      h[r.compositeId] = {
        storageKey: r.storageKey,
        uploadStatus: r.uploadStatus,
        ...(r.contentHash ? { contentHash: r.contentHash } : {}),
      };
    }
    return h;
  });

  return jsonResponse({ hits }, 200);
}

export async function attachmentsRecordHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const spaceId = (body as { spaceId?: unknown })?.spaceId;
  const source = parseSource((body as { source?: unknown })?.source);
  if (source === null) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof spaceId !== "string" || !UUID_RE.test(spaceId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // Comment-sourced record: the row already exists (register-first via
  // comments-sync); this stamps storage_key + upload_status after the write.
  if (source === "comment") {
    const cEntries = (body as { entries?: unknown })?.entries;
    if (!Array.isArray(cEntries) || !cEntries.every(isCommentRecordEntry)) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    if (cEntries.length === 0) return jsonResponse({ recorded: 0 }, 200);

    const resolved = await resolveOrError(locals, spaceId);
    if ("res" in resolved) return resolved.res;
    const { db } = locals.getMasterDb();

    await withSpaceSchema(db, resolved.pgLocator, async (tx) => {
      for (const e of cEntries) {
        const { commentId, attachmentId } = splitCommentKey(e.commentAttachmentId)!;
        const uploadStatus = e.uploadStatus ?? "uploaded";
        await tx
          .update(spacePg.commentAttachments)
          .set({
            storageKey: e.storageKey,
            contentHash: e.contentHash ?? null,
            filename: e.filename ?? undefined,
            sizeBytes: e.sizeBytes ?? undefined,
            mimeType: e.mimeType ?? undefined,
            uploadStatus,
            uploadedAt: uploadStatus === "uploaded" ? sql`now()` : null,
          })
          .where(
            and(
              eq(spacePg.commentAttachments.airtableCommentId, commentId),
              eq(spacePg.commentAttachments.airtableAttachmentId, attachmentId),
            ),
          );
      }
    });
    return jsonResponse({ recorded: cEntries.length }, 200);
  }

  const entries = (body as { entries?: unknown })?.entries;
  if (!Array.isArray(entries) || !entries.every(isRecordEntry)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (entries.length === 0) {
    return jsonResponse({ recorded: 0 }, 200);
  }

  const resolved = await resolveOrError(locals, spaceId);
  if ("res" in resolved) return resolved.res;
  const { db } = locals.getMasterDb();

  await withSpaceSchema(db, resolved.pgLocator, async (tx) => {
    await tx
      .insert(spacePg.attachments)
      .values(
        entries.map((e) => {
          const uploadStatus = e.uploadStatus ?? "uploaded";
          return {
            compositeId: e.compositeId,
            tableId: e.tableId,
            fieldId: e.fieldId,
            recordId: e.recordId,
            storageKey: e.storageKey,
            contentHash: e.contentHash ?? null,
            filename: e.filename ?? null,
            sizeBytes: e.sizeBytes ?? null,
            mimeType: e.mimeType ?? null,
            uploadStatus,
            uploadedAt: uploadStatus === "uploaded" ? sql`now()` : null,
          };
        }),
      )
      .onConflictDoUpdate({
        target: spacePg.attachments.compositeId,
        set: {
          storageKey: sql`excluded.storage_key`,
          contentHash: sql`excluded.content_hash`,
          filename: sql`excluded.filename`,
          sizeBytes: sql`excluded.size_bytes`,
          mimeType: sql`excluded.mime_type`,
          uploadStatus: sql`excluded.upload_status`,
          uploadedAt: sql`case when excluded.upload_status = 'uploaded' then now() else null end`,
        },
      });
  });

  return jsonResponse({ recorded: entries.length }, 200);
}
