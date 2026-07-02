// POST /api/internal/spaces/:spaceId/health-enable   { baseId, ruleId, enabled }
//
// Enable/disable a metric for a base (server-schema-health-scoring §4.2c). A
// disabled metric is excluded from scoring + grade aggregation. Pro+ gated
// web-side. Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { setMetricEnabled } from "../../../../lib/per-space/health-config-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesHealthEnableHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: { baseId?: unknown; ruleId?: unknown; enabled?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (
    typeof body.baseId !== "string" ||
    typeof body.ruleId !== "string" ||
    typeof body.enabled !== "boolean"
  ) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

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
    await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      setMetricEnabled(tx, {
        baseId: body.baseId as string,
        ruleId: body.ruleId as string,
        enabled: body.enabled as boolean,
      }),
    );
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "enable_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
