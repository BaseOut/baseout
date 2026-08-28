// /api/internal/spaces/:spaceId/documents/:documentId/tags
//   POST   → add one tag {targetType, targetId, addedVia?} (idempotent upsert)
//   DELETE → remove one tag by ?targetType=&targetId=
//
// Tag broker for the public API's tag/untag tools (api-documents-tools D5) —
// routes the previously-unrouted addTag/removeTag lib pieces. Mirrors the
// existing Schema Docs broker files (UUID gates, resolveSpaceDb posture).
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { addTag, documentExists, getDocument, removeTagByTarget } from "../../../../lib/per-space/documents";
import { parseTagRequest } from "../../../../lib/per-space/documents-logic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesDocumentTagsHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  documentId: string,
): Promise<Response> {
  const method = request.method;
  if (method !== "POST" && method !== "DELETE") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(documentId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let raw: unknown;
  if (method === "POST") {
    try {
      raw = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
  } else {
    const url = new URL(request.url);
    raw = {
      targetType: url.searchParams.get("targetType") ?? undefined,
      targetId: url.searchParams.get("targetId") ?? undefined,
    };
  }
  const tag = parseTagRequest(raw);
  if (!tag) return jsonResponse({ error: "invalid_request" }, 400);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    return await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      if (!(await documentExists(tx, documentId))) {
        return jsonResponse({ error: "document_not_found" }, 404);
      }
      if (method === "POST") {
        await addTag(tx, documentId, tag);
        const document = await getDocument(tx, documentId);
        return jsonResponse({ ok: true, document }, 200);
      }
      const removed = await removeTagByTarget(tx, documentId, tag.targetType, tag.targetId);
      if (!removed) return jsonResponse({ error: "tag_not_found" }, 404);
      const document = await getDocument(tx, documentId);
      return jsonResponse({ ok: true, document }, 200);
    });
  } catch (err) {
    return jsonResponse(
      { error: "document_tags_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
