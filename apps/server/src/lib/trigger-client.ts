// Worker-side wrapper around Trigger.dev's tasks.trigger().
//
// The SDK reads the API token from a global it sets via configure(); we
// call configure() at every entry point because the Worker runtime has
// no module-level "warmup" hook and we'd rather pay the (no-op when
// unchanged) reset than risk a missed token. configure() is idempotent
// for the same value — repeat calls do not race because every request
// in this Worker uses the same env.TRIGGER_SECRET_KEY.
//
// All wrappers take `env` explicitly; never read process.env (no such
// thing in workerd). Never log the token.
//
// Type-only imports for task definitions: tasks.trigger<typeof X>("X-id")
// gives us payload typing without bundling the task body into the Worker.

import { configure, tasks } from "@trigger.dev/sdk";
import type { Env } from "../env";
import type {
  pingTask,
  backupBaseTask,
  deleteRunFilesTask,
  DeleteRunFilesPayload,
  restoreBaseTask,
  RestoreBaseTaskPayload,
  chatRespondTask,
  ChatRespondPayload,
  healthScoreBaseTask,
  HealthScoreBasePayload,
} from "@baseout/workflows";
import type { BackupBaseTaskPayload } from "./runs/start";

// Re-export the canonical restore payload type (owned by apps/workflows'
// restore-base.task.ts) so server-side consumers keep importing it from here.
export type { RestoreBaseTaskPayload } from "@baseout/workflows";

function configureFromEnv(env: Env): void {
  configure({ accessToken: env.TRIGGER_SECRET_KEY });
}

export interface TriggerHandle {
  id: string;
}

/** Enqueue the no-op smoke task. Returns the run ID for cloud-dashboard verification. */
export async function enqueuePing(
  env: Env,
  payload: { echo?: unknown } = {},
): Promise<TriggerHandle> {
  configureFromEnv(env);
  const handle = await tasks.trigger<typeof pingTask>("_ping", payload);
  return { id: handle.id };
}

/**
 * Enqueue one backup-base run. The handler at /api/internal/runs/:runId/
 * start (Phase 8a) calls this once per included base in the backup_runs
 * row, then persists the returned IDs to backup_runs.trigger_run_ids so
 * /api/internal/runs/:runId/complete (Phase 8b) can match completions.
 */
export async function enqueueBackupBase(
  env: Env,
  payload: BackupBaseTaskPayload,
): Promise<TriggerHandle> {
  configureFromEnv(env);
  const handle = await tasks.trigger<typeof backupBaseTask>(
    "backup-base",
    payload,
  );
  return { id: handle.id };
}

/**
 * Enqueue one restore-base run (server-restore Phase B.5). The handler at
 * /api/internal/restores/:restoreId/start calls this for the target base(s)
 * in the restore_runs row, then persists the returned IDs to
 * restore_runs.trigger_run_ids so /api/internal/restores/:restoreId/complete
 * (Phase C) can match per-base completions.
 */
export async function enqueueRestoreBase(
  env: Env,
  payload: RestoreBaseTaskPayload,
): Promise<TriggerHandle> {
  configureFromEnv(env);
  const handle = await tasks.trigger<typeof restoreBaseTask>(
    "restore-base",
    payload,
  );
  return { id: handle.id };
}

/**
 * Enqueue the delete-run-files cleanup task (openspec/changes/shared-backup-run-delete
 * Phase C.5). The route at /api/internal/runs/:runId/delete triggers this
 * after CAS-flipping the row to 'deleting'. The task POSTs the result to
 * /api/internal/runs/:runId/delete-complete; the engine hard-DELETEs the
 * row on ok:true.
 */
export async function enqueueDeleteRunFiles(
  env: Env,
  payload: DeleteRunFilesPayload,
): Promise<TriggerHandle> {
  configureFromEnv(env);
  const handle = await tasks.trigger<typeof deleteRunFilesTask>(
    "delete-run-files",
    payload,
  );
  return { id: handle.id };
}

/**
 * Enqueue one Health scoring run for a base (server-schema-health-scoring). The
 * /health-rerun route resolves the enabled metrics + their effective prompts +
 * the schema context, then calls this; the task scores each metric via Claude and
 * POSTs /health-sync to write the sub-scores + base grade.
 */
export async function enqueueHealthScoreBase(
  env: Env,
  payload: HealthScoreBasePayload,
): Promise<TriggerHandle> {
  configureFromEnv(env);
  const handle = await tasks.trigger<typeof healthScoreBaseTask>(
    "health-score-base",
    payload,
  );
  return { id: handle.id };
}

/**
 * Enqueue one chat-respond turn (server-schema-chat). The /chat/send route
 * appends the user message + a pending assistant message, assembles the
 * metadata-only context, then calls this; the task generates the reply and POSTs
 * /chat/message-complete to flip the pending message to complete.
 */
export async function enqueueChatRespond(
  env: Env,
  payload: ChatRespondPayload,
): Promise<TriggerHandle> {
  configureFromEnv(env);
  const handle = await tasks.trigger<typeof chatRespondTask>(
    "chat-respond",
    payload,
  );
  return { id: handle.id };
}
