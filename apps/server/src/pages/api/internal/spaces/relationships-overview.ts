// GET /api/internal/spaces/:spaceId/relationships?baseId=appXXX[&includeRemoved=1]
//
// apps/web's Relationships tab reads a base's relationships: the API-derived set
// (linked records / formulas / rollups / lookups / lastModified, computed from
// bo_at_fields) plus synced-view candidates (inferred/confirmed). Mirrors the
// schema-read / health-overview guards.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { readRelationships } from "../../../../lib/per-space/relationships-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesRelationshipsOverviewHandler(
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
  if (!baseId) return jsonResponse({ error: "invalid_request" }, 400);
  const includeDismissed = sp.get("includeDismissed") === "1";

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });
    const overview = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      readRelationships(tx, baseId, { includeDismissed }),
    );
    return jsonResponse({ ok: true, ...overview }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
