// GET /api/internal/spaces/:spaceId/schema-versions?baseId=…[&limit=&cursor=]
//
// Captured schema versions for a base (server-rest-read-support): id, schemaHash,
// capturedAt — newest-first, cursor-paginated. The full schema_json payload is
// intentionally NOT included in listings. Token gate applied by middleware
// (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { readSchemaVersions } from "../../../../lib/per-space/schema-read-io";
import { clampLimit } from "../../../../lib/per-space/schema-query";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function spacesSchemaVersionsHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);
  const sp = new URL(request.url).searchParams;
  const baseId = sp.get("baseId");
  if (!baseId) return jsonResponse({ error: "invalid_request", param: "baseId" }, 400);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      readSchemaVersions(tx, baseId, { limit: clampLimit(sp.get("limit")), cursor: sp.get("cursor") }),
    );
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
