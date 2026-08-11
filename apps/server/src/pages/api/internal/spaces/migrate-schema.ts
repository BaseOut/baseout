// POST /api/internal/spaces/:spaceId/migrate-schema  (system-per-space-upgrade)
//
// Explicit in-place upgrade of a managed_pg Space's per-Space schema to the
// current version (the same idempotent DDL the read routes run lazily). Useful
// for ops / a backfill sweep over existing Spaces. Idempotent: a Space already
// current returns { upgraded: false }.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesMigrateSchemaHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "upgrade_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
