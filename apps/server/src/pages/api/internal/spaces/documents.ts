// /api/internal/spaces/:spaceId/documents
//   GET  → list documents (Docs tab)
//   POST → create a document
//
// Schema Docs read/write broker (openspec/changes/shared-schema-docs §2).
// apps/web proxies here; the browser never touches the per-Space DB. Token gate
// is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import {
  createDocument,
  listDocuments,
  type CreateDocumentInput,
} from "../../../../lib/per-space/documents";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesDocumentsHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let input: CreateDocumentInput | undefined;
  if (request.method === "POST") {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const body = raw as { title?: unknown };
    if (typeof body.title !== "string" || body.title.trim() === "") {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    input = raw as CreateDocumentInput;
  }

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    if (request.method === "GET") {
      const documents = await withSpaceSchema(masterDb, space.pgLocator, (tx) => listDocuments(tx));
      return jsonResponse({ ok: true, documents }, 200);
    }
    const document = await withSpaceSchema(masterDb, space.pgLocator, (tx) => createDocument(tx, input!));
    return jsonResponse({ ok: true, document }, 201);
  } catch (err) {
    return jsonResponse(
      { error: "documents_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
