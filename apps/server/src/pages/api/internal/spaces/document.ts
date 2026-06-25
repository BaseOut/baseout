// /api/internal/spaces/:spaceId/documents/:documentId
//   GET    → full document (tags flagged, links + diagrams)
//   PATCH  → atomic save (title/body/tags/links/diagrams)
//   DELETE → delete document + its tags/links/diagrams
//
// Schema Docs read/write broker (openspec/changes/shared-schema-docs §2).
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import {
  deleteDocument,
  getDocument,
  updateDocument,
  type UpdateDocumentPatch,
} from "../../../../lib/per-space/documents";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesDocumentHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  documentId: string,
): Promise<Response> {
  const method = request.method;
  if (method !== "GET" && method !== "PATCH" && method !== "DELETE") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(documentId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let patch: UpdateDocumentPatch | undefined;
  if (method === "PATCH") {
    try {
      patch = (await request.json()) as UpdateDocumentPatch;
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
  }

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    if (method === "GET") {
      const document = await withSpaceSchema(masterDb, space.pgLocator, (tx) => getDocument(tx, documentId));
      if (!document) return jsonResponse({ error: "document_not_found" }, 404);
      return jsonResponse({ ok: true, document }, 200);
    }
    if (method === "PATCH") {
      const document = await withSpaceSchema(masterDb, space.pgLocator, (tx) => updateDocument(tx, documentId, patch!));
      if (!document) return jsonResponse({ error: "document_not_found" }, 404);
      return jsonResponse({ ok: true, document }, 200);
    }
    // DELETE
    const existed = await withSpaceSchema(masterDb, space.pgLocator, (tx) => deleteDocument(tx, documentId));
    if (!existed) return jsonResponse({ error: "document_not_found" }, 404);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "document_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
