// GET /api/internal/spaces/:spaceId/health-config?baseId=appXXX
//
// The Pro+ Health editor's data: every catalog metric with its per-base enabled
// state, effective prompt (+ source), the system default, and a staleness flag
// (prompt edited after the last score). Mirrors health-overview's guards.
// Token gate is applied by middleware (path begins /api/internal/).

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { spaces, healthScoreRules } from "../../../../db/schema";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { readHealthConfigRows } from "../../../../lib/per-space/health-config-io";
import { resolveMetricPrompt, isMetricStale } from "../../../../lib/per-space/health-scoring";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesHealthConfigHandler(
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

  const [spaceRow] = await masterDb
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  if (!spaceRow) return jsonResponse({ ok: true, metrics: [] }, 200);

  const catalog = await masterDb
    .select({
      id: healthScoreRules.id,
      name: healthScoreRules.name,
      category: healthScoreRules.category,
      severity: healthScoreRules.severity,
      weight: healthScoreRules.weight,
      entityTier: healthScoreRules.entityTier,
      enabled: healthScoreRules.enabled,
      prompt: healthScoreRules.prompt,
    })
    .from(healthScoreRules)
    .where(eq(healthScoreRules.organizationId, spaceRow.organizationId));

  try {
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });
    const cfg = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      readHealthConfigRows(tx, baseId),
    );

    const metrics = catalog
      .filter((r) => r.enabled) // org-disabled rules aren't editable here
      .map((r) => {
        const override = cfg.baseOverrides.get(r.id) ?? null;
        const spacePrompt = cfg.spacePrompts.get(r.id) ?? null;
        const resolved = resolveMetricPrompt({
          override: override?.prompt ?? null,
          space: spacePrompt?.prompt ?? null,
          systemDefault: r.prompt ?? "",
        });
        const sourceUpdatedAt =
          resolved.source === "override"
            ? override?.updatedAt ?? null
            : resolved.source === "space"
              ? spacePrompt?.updatedAt ?? null
              : null;
        const lastGeneratedAt = cfg.lastGeneratedAt.get(r.id) ?? null;
        return {
          ruleId: r.id,
          name: r.name,
          category: r.category,
          severity: r.severity,
          weight: r.weight,
          entityTier: r.entityTier,
          enabled: cfg.state.get(r.id) ?? true,
          effectivePrompt: resolved.prompt,
          promptSource: resolved.source,
          systemDefault: r.prompt ?? "",
          hasSpacePrompt: spacePrompt !== null,
          hasBaseOverride: override !== null,
          scored: lastGeneratedAt !== null,
          isStale: isMetricStale(sourceUpdatedAt, lastGeneratedAt),
        };
      });

    return jsonResponse({ ok: true, metrics }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
