// POST /api/internal/cleanup-complete
//
// Callback the apps/workflows `cleanup-expired-snapshots` cron POSTs after
// attempting to delete each planned run's storage objects
// (openspec/changes/server-retention-and-cleanup Phase C). For every runId
// reported with ok:true we soft-delete the row — UPDATE deleted_at = now()
// WHERE deleted_at IS NULL. The row itself is RETAINED for audit (unlike the
// user-initiated per-run delete, which hard-DELETEs); cleanup queries filter
// `deleted_at IS NULL`. Idempotent: a row already soft-deleted is skipped.
//
// runId-with-ok:false rows are left untouched — deleted_at stays NULL so the
// next hourly pass retries them.
//
// Token gate is applied by middleware (path begins /api/internal/). Returns:
//   ok               → 200  { updated: <rows soft-deleted this call> }
//   invalid body     → 400  { error: 'invalid_request' }
//   non-POST         → 405

import { and, inArray, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../env";
import { backupRuns } from "../../../db/schema";
import { finalizeServiceRun } from "../../../lib/service-runs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface CleanupCompleteBody {
  completed: Array<{ runId: string; ok: boolean }>;
  /** shared-service-runs: echoed from the plan response; finalizes that run row. */
  serviceRunId?: string | null;
}

function isCleanupCompleteBody(x: unknown): x is CleanupCompleteBody {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.completed)) return false;
  return o.completed.every((c) => {
    if (typeof c !== "object" || c === null) return false;
    const e = c as Record<string, unknown>;
    return typeof e.runId === "string" && typeof e.ok === "boolean";
  });
}

export async function cleanupCompleteHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (!isCleanupCompleteBody(body)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const okIds = body.completed
    .filter((c) => c.ok && UUID_RE.test(c.runId))
    .map((c) => c.runId);

  // Need the DB if anything soft-deletes OR a retention_cleanup run must finalize.
  if (okIds.length === 0 && !body.serviceRunId) {
    return jsonResponse({ updated: 0 }, 200);
  }

  const { db } = locals.getMasterDb();
  const now = new Date();
  let updated = 0;
  if (okIds.length > 0) {
    const rows = await db
      .update(backupRuns)
      .set({ deletedAt: now, modifiedAt: now })
      .where(
        and(
          inArray(backupRuns.id, okIds),
          sql`${backupRuns.deletedAt} IS NULL`,
        ),
      )
      .returning({ id: backupRuns.id });
    updated = rows.length;
  }

  // shared-service-runs: finalize the retention_cleanup row opened by
  // /cleanup-plan (missing/unknown id → no-op; forward/backward compatible during
  // deploy skew). Record-keeping failures are swallowed by finalizeServiceRun.
  if (body.serviceRunId) {
    await finalizeServiceRun(db, body.serviceRunId, {
      status: "succeeded",
      counts: { deleted: updated, attempted: body.completed.length },
    });
  }

  // event: 'backup_cleanup_pass' (structured log lands with the observability
  // surface; no raw console per CLAUDE.md §3.5).
  return jsonResponse({ updated }, 200);
}
