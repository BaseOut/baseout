// POST /api/internal/restores/:restoreId/start (server-restore Phase B.4)
//
// Mirrors apps/server/src/pages/api/internal/runs/start.ts.
//
// Routing + DB-and-Trigger.dev wiring on top of the pure processRestoreStart()
// function in src/lib/restores/start.ts. apps/web's POST
// /api/restores/:restoreId/start calls this via the BACKUP_ENGINE service
// binding once it has INSERTed a restore_runs row in 'queued' state.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID), then delegates to processRestoreStart
// which reads the restore run + connection + storage destination + source run,
// enqueues one Trigger.dev restore-base task, and persists the trigger run IDs.
//
// Result-code → HTTP-status mapping:
//   ok                          → 202  { restoreId, triggerRunIds }
//   restore_not_found           → 404
//   restore_already_started     → 409
//   connection_not_found        → 404
//   invalid_connection          → 422
//   storage_not_found           → 422
//   source_run_not_found        → 422
//   source_run_not_restorable   → 422

import type { AppLocals, Env } from "../../../../env";
import {
  processRestoreStart,
  type ProcessRestoreStartResult,
} from "../../../../lib/restores/start";
import { buildRestoreStartDeps } from "../../../../lib/restores/start-deps";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRestoreStartResult): number {
  if (result.ok) return 202;
  switch (result.error) {
    case "restore_not_found":
    case "connection_not_found":
      return 404;
    case "restore_already_started":
      return 409;
    case "invalid_connection":
    case "storage_not_found":
    case "source_run_not_found":
    case "source_run_not_restorable":
      return 422;
  }
}

export async function restoresStartHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  restoreId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(restoreId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  const result = await processRestoreStart(
    { restoreId },
    buildRestoreStartDeps(db, env),
  );

  if (result.ok) {
    return jsonResponse(
      { restoreId: result.restoreId, triggerRunIds: result.triggerRunIds },
      statusFor(result),
    );
  }
  return jsonResponse({ error: result.error }, statusFor(result));
}
