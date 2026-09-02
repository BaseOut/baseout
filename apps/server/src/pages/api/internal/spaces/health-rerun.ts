// POST /api/internal/spaces/:spaceId/health-rerun   { baseId }
//
// Scores the base's enabled metrics ENGINE-SIDE on the Workers AI binding
// (all-Cloudflare POC, 2026-07-10 — replaced the Claude-via-Trigger.dev
// enqueue; zero API keys). Generation runs after the response via waitUntil
// with a fresh DB client; the web polls /health-overview for the result, same
// contract as before. Returns the generated runId.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { createMasterDb } from "../../../../db/worker";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { resolveScoreInputs } from "../../../../lib/per-space/health-resolve";
import { runEngineHealthScore, workersAiScoreMetric } from "../../../../lib/per-space/health-score-run";
import { resolveByokAdapterForSpace } from "../../../../lib/ai/byok-credential";
import { spaceMatchesWorkerEnv } from "../../../../lib/assert-organization-runtime-env";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesHealthRerunHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: { baseId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (typeof body.baseId !== "string" || body.baseId.length === 0) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const baseId = body.baseId;

  const { db: masterDb, sql } = locals.getMasterDb();
  if (!(await spaceMatchesWorkerEnv(masterDb, env, spaceId))) {
    return jsonResponse({ error: "env_mismatch" }, 403);
  }
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

    const { metrics } = await resolveScoreInputs(masterDb, space.pgLocator, {
      spaceId,
      baseId,
    });
    if (metrics.length === 0) {
      return jsonResponse({ ok: true, enqueued: false, reason: "no_enabled_metrics" }, 200);
    }

    // Availability gate (unchanged); the pool closure is reused below when the
    // org isn't BYOK.
    const scoreMetric = workersAiScoreMetric(env);
    if (!scoreMetric) {
      return jsonResponse({ ok: true, enqueued: false, reason: "ai_unavailable" }, 200);
    }

    const runId = crypto.randomUUID();
    const pgLocator = space.pgLocator;
    ctx.waitUntil(
      (async () => {
        const fresh = createMasterDb(env);
        try {
          // BYOK routing resolved server-side (in-Worker decrypt, shared-ai-byok
          // 4.2); null = pool. Never fails the run over BYOK.
          const byok = await resolveByokAdapterForSpace(fresh.db, env.BASEOUT_ENCRYPTION_KEY, spaceId);
          // `?? scoreMetric` keeps the non-null pool closure when byok is off.
          const scoreMetricFn = (byok ? workersAiScoreMetric(env, byok) : scoreMetric) ?? scoreMetric;
          await runEngineHealthScore({ masterDb: fresh.db, pgLocator, spaceId, baseId, runId, scoreMetric: scoreMetricFn });
        } catch (err) {
          // eslint-disable-next-line no-console -- background-scoring failure would otherwise be invisible
          console.error("health-score run failed:", err instanceof Error ? err.message : String(err));
        } finally {
          await fresh.sql.end({ timeout: 5 }).catch(() => {});
        }
      })(),
    );
    return jsonResponse({ ok: true, enqueued: true, runId, metricCount: metrics.length }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "rerun_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
