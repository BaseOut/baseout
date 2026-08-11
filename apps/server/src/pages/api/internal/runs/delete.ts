// POST /api/internal/runs/:runId/delete
//
// Internal route the apps/web Delete button forwards to via the
// BACKUP_ENGINE service binding. Atomically transitions the row from
// <terminal> → 'deleting' and enqueues the delete-run-files Trigger.dev
// task. The task POSTs back to /delete-complete which hard-DELETEs the
// row. See src/lib/runs/delete.ts for the state machine.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) then delegates to processRunDelete.
//
// Result-code → HTTP-status mapping:
//   ok                          → 202  { ok: true, triggerRunId }
//   run_not_found               → 404
//   run_not_terminal            → 409
//   delete_in_progress          → 409
//
// Filed by openspec/changes/shared-backup-run-delete (Phase C.3).

import type { AppLocals, Env } from "../../../../env";
import {
  processRunDelete,
  type ProcessRunDeleteResult,
} from "../../../../lib/runs/delete";
import { buildRunDeleteDeps } from "../../../../lib/runs/delete-deps";
import { enqueueDeleteRunFiles } from "../../../../lib/trigger-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRunDeleteResult): number {
  if (result.ok) return 202;
  switch (result.error) {
    case "run_not_found":
      return 404;
    case "run_not_terminal":
    case "delete_in_progress":
      return 409;
  }
}

export async function runsDeleteHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  runId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  const result = await processRunDelete(
    { runId },
    buildRunDeleteDeps(db),
  );

  if (!result.ok) {
    return jsonResponse({ error: result.error }, statusFor(result));
  }

  // CAS won — enqueue the file-delete task. Fire-and-forget from the
  // engine's perspective; the task POSTs /delete-complete on finish,
  // which hard-DELETEs the row.
  const handle = await enqueueDeleteRunFiles(env, {
    runId,
    storageType: result.storageType,
    prefixes: result.prefixes,
  });

  return jsonResponse(
    { ok: true, triggerRunId: handle.id },
    statusFor(result),
  );
}
