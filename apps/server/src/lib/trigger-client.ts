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
} from "@baseout/workflows";
import type { BackupBaseTaskPayload } from "./runs/start";

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
 * Wire-shape payload for the restore-base Trigger.dev task. Declared locally
 * because `@baseout/workflows` does not yet export `restoreBaseTask` — that
 * export lands in the paired `workflows-restore` change.
 *
 * TODO(workflows-restore): switch `tasks.trigger("restore-base", payload)` to
 *   `tasks.trigger<typeof restoreBaseTask>("restore-base", payload)` and import
 *   the type once `apps/workflows/trigger/tasks/index.ts` exports it.
 *
 * β decision (mirroring backup): orgSlug ← connection.organizationId (UUID),
 * spaceName ← restoreRun.spaceId (UUID). Upgrade when orgs/spaces are mirrored.
 */
export interface RestoreBaseTaskPayload {
  /** restore_runs.id — the row the task reports progress + completion against. */
  restoreId: string;
  /** connections.id — used by the task to identify the Airtable workspace. */
  connectionId: string;
  /** backup_runs.id — the snapshot the task reads CSVs from. */
  sourceRunId: string;
  /** Airtable base ID from restore_runs.scope_target.baseId, e.g. "appXXXXXX". */
  atBaseId: string;
  /**
   * Source base display name — path segment, must match what the backup run
   * wrote (at_bases.name at the time of the backup). Used to locate the
   * `<baseName>` directory in the CSV storage path:
   *   `<orgSlug>/<spaceName>/<baseName>/<datetime>/`.
   */
  baseName: string;
  /** Trial cap flag — restore task enforces same 5-table / 1K-record caps as backup. */
  isTrial: boolean;
  /** AES-256-GCM ciphertext of the Airtable OAuth access token. */
  encryptedToken: string;
  /** β: connection.organizationId UUID (not slug). */
  orgSlug: string;
  /** β: restoreRun.spaceId UUID (not name). */
  spaceName: string;
  /**
   * Storage provider type — the workflows StorageReader factory uses this to
   * resolve which reader to use for the snapshot CSVs. Must match the value
   * written by the backup run (storage_destinations.type).
   * Accept-list: 'local_fs' | 'r2_managed' | 'google_drive' | 'box' | 'dropbox' | 'onedrive'.
   */
  storageType: string;
  /** restore_runs.space_id — used by workflows to fetch storage credentials from
   * /api/internal/spaces/:spaceId/storage-destination. */
  spaceId: string;
  /** restore_runs.scope — 'base' | 'table' | 'point_in_time'. */
  scope: string;
  /** restore_runs.scope_target — { baseId, tableId?, runId? }. */
  scopeTarget: { baseId: string; tableId?: string; runId?: string };
  /**
   * ISO-8601 startedAt of the SOURCE backup run (backup_runs.started_at) —
   * the storage path `<datetime>` segment the task reads CSVs from.
   * NOT the restore's own start time. The path the backup task wrote is:
   *   `<orgSlug>/<spaceName>/<baseName>/<datetime>/<tableName>.csv`
   * where `<datetime>` is derived from the backup run's startedAt.
   */
  sourceRunStartedAt: string;
}

/**
 * Enqueue one restore-base run (server-restore Phase B.5). The handler at
 * /api/internal/restores/:restoreId/start calls this for the target base(s)
 * in the restore_runs row, then persists the returned IDs to
 * restore_runs.trigger_run_ids so /api/internal/restores/:restoreId/complete
 * (Phase C) can match per-base completions.
 *
 * Uses the string task-id form ("restore-base") rather than
 * `tasks.trigger<typeof restoreBaseTask>(...)` because the type export does
 * not exist yet in @baseout/workflows.
 * TODO(workflows-restore): switch to typed form once the export lands.
 */
export async function enqueueRestoreBase(
  env: Env,
  payload: RestoreBaseTaskPayload,
): Promise<TriggerHandle> {
  configureFromEnv(env);
  // String task-id used intentionally — see RestoreBaseTaskPayload comment above.
  const handle = await tasks.trigger("restore-base", payload);
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
