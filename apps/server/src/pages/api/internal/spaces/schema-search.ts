// POST /api/internal/spaces/:spaceId/schema-search
//
// Structured schema search over the per-Space DB for the public read API
// (server-rest-read-support). Accepts the search config apps/api already
// Zod-validated; re-validates defensively here, executes case-insensitive LIKE
// matching with wildcard escaping across bases/tables/fields/views, and returns
// heterogeneous hits with full ancestry + per-base schemaHash + nextCursor.
// Token gate applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { searchSchema } from "../../../../lib/per-space/schema-read-io";
import { normalizeSearchConfig } from "../../../../lib/per-space/schema-query";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function spacesSchemaSearchHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request", param: "body" }, 400);
  }
  const parsed = normalizeSearchConfig(body);
  if (!parsed.ok) return jsonResponse({ error: "invalid_request", param: parsed.param, message: parsed.message }, 400);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) => searchSchema(tx, parsed.config));
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "schema_search_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
