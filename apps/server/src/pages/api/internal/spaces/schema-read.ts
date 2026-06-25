// GET /api/internal/spaces/:spaceId/schema
//
// Read broker for the captured schema entity tree (Browse tab). Returns flat
// lists of bases/tables/fields/views from the per-Space DB. Schema Docs
// (openspec/changes/shared-schema-docs §4). Distinct from schema-sync, which is
// the write path. Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { readAllEntities, withSpaceSchema } from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesSchemaReadHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const entities = await withSpaceSchema(masterDb, space.pgLocator, (tx) => readAllEntities(tx));
    return jsonResponse({ ok: true, ...entities }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "schema_read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
