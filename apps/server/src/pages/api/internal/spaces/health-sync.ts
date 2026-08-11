// POST /api/internal/spaces/:spaceId/health-sync
//
// The workflows `health-score-base` task POSTs per-metric sub-scores + findings
// for ONE base; the engine writes them to the per-Space result tables
// (bo_at_health_metric_scores + bo_at_health_issues). Mirrors schema-sync's
// guards. Base-grade aggregation + the read/overview routes are a follow-up.
//
// Token gate is applied by middleware (path begins /api/internal/).

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { spaces, healthScoreRules } from "../../../../db/schema";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { writeHealthResults, type HealthSyncMetric } from "../../../../lib/per-space/health-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesHealthSyncHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const body = raw as { baseId?: unknown; runId?: unknown; metrics?: unknown };
  if (typeof body.baseId !== "string" || body.baseId.length === 0) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (!UUID_RE.test(String(body.runId))) return jsonResponse({ error: "invalid_request" }, 400);
  if (!Array.isArray(body.metrics)) return jsonResponse({ error: "invalid_request" }, 400);
  const metrics = body.metrics as HealthSyncMetric[];

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  // Catalog weights for the base-grade aggregation (org-scoped, master DB).
  const [spaceRow] = await masterDb
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  const weightByRuleId: Record<string, number> = {};
  if (spaceRow) {
    const rules = await masterDb
      .select({ id: healthScoreRules.id, weight: healthScoreRules.weight })
      .from(healthScoreRules)
      .where(eq(healthScoreRules.organizationId, spaceRow.organizationId));
    for (const r of rules) weightByRuleId[r.id] = r.weight;
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      writeHealthResults(tx, {
        baseId: body.baseId as string,
        runId: String(body.runId),
        metrics,
        weightByRuleId,
      }),
    );
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "sync_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
