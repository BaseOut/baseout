// GET /api/internal/spaces/:spaceId/docs-by-entity?targetType=&targetId=
//
// Browse-tab detail surfacing: the documents that tag a given schema entity,
// plus an `entityRemoved` flag (the entity is absent or removed from Airtable).
// Schema Docs read broker (openspec/changes/shared-schema-docs §2). Token gate
// is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { readDocsForEntity } from "../../../../lib/per-space/documents";
import type { DocTargetType } from "../../../../lib/per-space/documents-logic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGET_TYPES: readonly DocTargetType[] = ["base", "table", "field", "view"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesDocsByEntityHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  const url = new URL(request.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  if (!targetType || !TARGET_TYPES.includes(targetType as DocTargetType) || !targetId) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      readDocsForEntity(tx, targetType as DocTargetType, targetId),
    );
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "docs_by_entity_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
