// GET /api/internal/spaces/:spaceId/health-overview?baseId=appXXX
//
// apps/web's Health tab proxy reads a base's current Health results: the grade,
// the per-metric breakdown (per-Space sub-scores enriched with the master
// catalog's name/weight/severity/tier), and the issue list. Mirrors schema-read
// guards. Mutation routes (prompt/enable/rerun) + the per-run trend are
// follow-ups (server-schema-health-scoring §4.2c).
//
// Token gate is applied by middleware (path begins /api/internal/).

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { spaces, healthScoreRules } from "../../../../db/schema";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { readHealthOverview } from "../../../../lib/per-space/health-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesHealthOverviewHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);
  const baseId = new URL(request.url).searchParams.get("baseId");
  if (!baseId) return jsonResponse({ error: "invalid_request" }, 400);

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }
  // Self-heal an older Space to the current schema before reading (lazy upgrade).
  try {
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });
  } catch (err) {
    return jsonResponse(
      { error: "upgrade_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }

  // Catalog labels (org-scoped, master DB) for the per-metric breakdown.
  const [spaceRow] = await masterDb
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  const catalog = new Map<
    string,
    { name: string; weight: number; severity: string; category: string | null; entityTier: string | null }
  >();
  if (spaceRow) {
    const rules = await masterDb
      .select({
        id: healthScoreRules.id,
        name: healthScoreRules.name,
        weight: healthScoreRules.weight,
        severity: healthScoreRules.severity,
        category: healthScoreRules.category,
        entityTier: healthScoreRules.entityTier,
      })
      .from(healthScoreRules)
      .where(eq(healthScoreRules.organizationId, spaceRow.organizationId));
    for (const r of rules) {
      catalog.set(r.id, {
        name: r.name,
        weight: r.weight,
        severity: r.severity,
        category: r.category,
        entityTier: r.entityTier,
      });
    }
  }

  try {
    const overview = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      readHealthOverview(tx, baseId),
    );
    const metrics = overview.metrics.map((m) => {
      const c = catalog.get(m.ruleId);
      return {
        ruleId: m.ruleId,
        name: c?.name ?? m.ruleId,
        weight: c?.weight ?? 0,
        severity: c?.severity ?? null,
        entityTier: c?.entityTier ?? null,
        score: m.score,
        lastGeneratedAt: m.lastGeneratedAt,
      };
    });
    return jsonResponse({ ok: true, grade: overview.grade, metrics, issues: overview.issues }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
