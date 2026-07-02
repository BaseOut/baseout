// POST /api/internal/spaces/:spaceId/health-rerun   { baseId }
//
// Resolves the base's enabled metrics + effective prompts + schema context and
// enqueues the workflows health-score-base task, which scores each metric via
// Claude and POSTs /health-sync. This is the trigger that makes Health produce
// data (manual re-score; Pro+ gated web-side). Returns the generated runId.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { resolveScoreInputs } from "../../../../lib/per-space/health-resolve";
import { enqueueHealthScoreBase } from "../../../../lib/trigger-client";

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
  _ctx: ExecutionContext,
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

    const { metrics, schemaContext } = await resolveScoreInputs(masterDb, space.pgLocator, {
      spaceId,
      baseId,
    });
    if (metrics.length === 0) {
      return jsonResponse({ ok: true, enqueued: false, reason: "no_enabled_metrics" }, 200);
    }

    const runId = crypto.randomUUID();
    await enqueueHealthScoreBase(env, { spaceId, baseId, runId, metrics, schemaContext });
    return jsonResponse({ ok: true, enqueued: true, runId, metricCount: metrics.length }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "rerun_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
