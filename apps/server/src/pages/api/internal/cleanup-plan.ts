// POST /api/internal/cleanup-plan
//
// The ENGINE half of the retention cleanup pass
// (openspec/changes/server-retention-and-cleanup Phase C). The apps/workflows
// `cleanup-expired-snapshots` hourly cron POSTs here to fetch the delete plan:
// for every Space with live runs, the engine resolves its policy + tier-cap,
// runs decideDeletions, and returns the runs to prune with their per-base
// storage prefixes. The cron then performs the actual StorageWriter.deletePrefix
// in the Node runtime (Workers can't reach R2/BYOS) and POSTs the outcome to
// /api/internal/cleanup-complete.
//
// This handler is Worker-safe: DB reads only, no storage access.
//
// Token gate is applied by middleware (path begins /api/internal/). Returns:
//   ok        → 200  { runs: [{ runId, spaceId, storageType, prefixes }] }
//   non-POST  → 405

import type { AppLocals, Env } from "../../../env";
import { buildCleanupPlan } from "../../../lib/retention/build-cleanup-plan";
import { buildCleanupPlanDeps } from "../../../lib/retention/cleanup-deps";
import { openServiceRun } from "../../../lib/service-runs";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function cleanupPlanHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const { db } = locals.getMasterDb();
  const plan = await buildCleanupPlan(
    buildCleanupPlanDeps(db, {
      retentionFromEntitlements: env.RETENTION_FROM_ENTITLEMENTS === "1",
    }),
    new Date(),
  );
  // shared-service-runs: open a retention_cleanup run row and echo its id; the
  // workflows cron carries it back to /cleanup-complete for finalize. Null when
  // the insert failed (logged) — the pass still runs; the id is just omitted.
  const serviceRunId = await openServiceRun(db, "retention_cleanup");
  return jsonResponse({ ...plan, serviceRunId }, 200);
}
