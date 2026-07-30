// POST /api/internal/spaces/:spaceId/comments-sync
//
// The workflows backup task streams batched per-record comment captures during
// the fan-out (workflows-comments); the engine diffs each batch against
// bo_at_comments and writes upserts + soft deletions. Deletion scope is per
// `complete` record capture (design Decision 3) — records absent from the
// batch are untouched, so incremental runs are safe by construction.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import {
  diffCommentBatch,
  extractCommentBatch,
} from "../../../../lib/per-space/comments-sync";
import {
  diffCommentAttachments,
  extractCommentAttachments,
} from "../../../../lib/per-space/comment-attachments-sync";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  applyCommentAttachmentBatch,
  applyCommentBatch,
  ensureBaseRun,
  readCommentAttachmentWorkingSet,
  readCommentWorkingSet,
  withSpaceSchema,
} from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesCommentsSyncHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const body = raw as { backupRunId?: unknown; baseId?: unknown; records?: unknown };
  if (!UUID_RE.test(String(body.backupRunId))) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof body.baseId !== "string" || !Array.isArray(body.records)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const backupRunId = String(body.backupRunId);
  const baseId = body.baseId;

  // Malformed-entry leniency lives in extraction (dropped + counted).
  const batch = extractCommentBatch(body.records);
  // Comment attachments ride the same payload (register-first). This route is
  // only called when the tier has comments enabled (the capture task gates it),
  // so no separate flag check is needed here — the gate is upstream.
  const attach = extractCommentAttachments(body.records);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      const baseRunId = await ensureBaseRun(tx, backupRunId, baseId);
      const prior = await readCommentWorkingSet(
        tx,
        batch.records.map((r) => r.recordId),
      );
      const diff = diffCommentBatch({ batch, prior });
      await applyCommentBatch(tx, { baseId, baseRunId, diff });

      // Comment attachments: prior scope = every comment id we saw this batch
      // (attachment-bearing + fully re-captured, so all-removed comments still
      // diff their prior attachments).
      const attachCommentIds = [
        ...new Set([
          ...attach.attachments.map((a) => a.commentId),
          ...attach.completeComments,
        ]),
      ];
      const attachPrior = await readCommentAttachmentWorkingSet(tx, attachCommentIds);
      const attachDiff = diffCommentAttachments({ extracted: attach, prior: attachPrior });
      await applyCommentAttachmentBatch(tx, { baseId, baseRunId, diff: attachDiff });

      return { diff, attachDiff };
    });

    return jsonResponse(
      {
        ok: true,
        records: batch.records.length,
        comments: result.diff.upserts.length,
        added: result.diff.added,
        updated: result.diff.updated,
        deleted: result.diff.deletions.length,
        dropped: batch.dropped,
        // The in-flight capture task downloads these while URLs are live.
        commentAttachments: {
          pending: result.attachDiff.pendingSet,
          registered: result.attachDiff.upserts.length,
          deleted: result.attachDiff.deletions.length,
          dropped: attach.dropped,
        },
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      { error: "sync_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
