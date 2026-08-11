// Pure-function orchestration for the restore-start flow (server-restore Phase B.2).
//
// processRestoreStart() validates a queued restore_runs row, transitions it
// to 'running', and fans out one Trigger.dev restore-base task. All
// side-effects (DB queries, task enqueue) are injected as deps — this
// mirrors processRunStart() in apps/server/src/lib/runs/start.ts so the
// validation paths are unit-testable without touching Postgres or Trigger.dev.
//
// Phase B scope decisions (mirroring backup β decisions):
//   - β: orgSlug ← connection.organizationId (UUID, not slug);
//        spaceName ← restoreRun.spaceId (UUID, not name).
//        Mirroring `organizations` + `spaces` is a tagged follow-up.
//   - Unlike backup, restore reads one base per restore_runs row (scoped to
//     scope_target.baseId). A single enqueue replaces the backup fan-out loop.
//   - Storage destination validation: confirm the Space has a storage
//     destination row before enqueueing. Mirrors the backup config check
//     (which validates storageType from backup_configurations).
//   - Source run validation: the source backup run must exist, belong to the
//     same space as the restore run, be in a restorable terminal state
//     (succeeded | trial_succeeded), and have a non-null startedAt — because
//     startedAt IS the `<datetime>` segment in the CSV storage path the task
//     reads from.

import type { RestoreRunRow, ConnectionRow, StorageDestinationRow } from "../../db/schema";
import type { RestoreBaseTaskPayload } from "../trigger-client";

export interface ProcessRestoreStartInput {
  restoreId: string;
}

/** Minimal shape of a backup_runs row needed for source-run validation. */
export interface SourceRunInfo {
  id: string;
  spaceId: string;
  status: string;
  startedAt: Date | null;
}

/** Restorable terminal statuses — the CSV files exist and are complete. */
const RESTORABLE_STATUSES = new Set(["succeeded", "trial_succeeded"]);

export interface ProcessRestoreStartDeps {
  fetchRestoreRunById: (restoreId: string) => Promise<RestoreRunRow | null>;
  fetchConnectionById: (connectionId: string) => Promise<ConnectionRow | null>;
  fetchStorageDestinationBySpace: (
    spaceId: string,
  ) => Promise<StorageDestinationRow | null>;
  /**
   * Fetch the source backup run by ID. Returns only the columns needed for
   * path resolution + validation (id, spaceId, status, startedAt).
   */
  fetchSourceRun: (sourceRunId: string) => Promise<SourceRunInfo | null>;
  /**
   * Resolve the Airtable base's display name from at_bases by the Airtable
   * base ID (e.g. "appXXXXXX"). This must match what the backup task wrote
   * as the path segment (at_bases.name).
   */
  fetchBaseName: (atBaseId: string) => Promise<string | null>;
  updateRestoreRunStarted: (restoreId: string, startedAt: Date) => Promise<void>;
  updateRestoreRunTriggerIds: (
    restoreId: string,
    triggerRunIds: string[],
  ) => Promise<void>;
  enqueueRestoreBase: (
    payload: RestoreBaseTaskPayload,
  ) => Promise<{ id: string }>;
  /** Test seam — defaults to () => new Date() in production. */
  now?: () => Date;
}

export type ProcessRestoreStartResult =
  | { ok: true; restoreId: string; triggerRunIds: string[] }
  | {
      ok: false;
      error:
        | "restore_not_found"
        | "restore_already_started"
        | "connection_not_found"
        | "invalid_connection"
        | "storage_not_found"
        | "source_run_not_found"
        | "source_run_not_restorable";
    };

export async function processRestoreStart(
  input: ProcessRestoreStartInput,
  deps: ProcessRestoreStartDeps,
): Promise<ProcessRestoreStartResult> {
  const now = deps.now ?? (() => new Date());

  // 1. Restore run row must exist and be queued.
  const restoreRun = await deps.fetchRestoreRunById(input.restoreId);
  if (!restoreRun) return { ok: false, error: "restore_not_found" };
  if (restoreRun.status !== "queued") {
    return { ok: false, error: "restore_already_started" };
  }

  // 2. Connection must exist and be active. apps/web's reconnect flow flips
  //    status to 'pending_reauth'/'invalid' when Airtable rejects the stored
  //    token; the cron-OAuth-refresh change does the same proactively.
  const connection = await deps.fetchConnectionById(restoreRun.connectionId);
  if (!connection) return { ok: false, error: "connection_not_found" };
  if (connection.status !== "active") {
    return { ok: false, error: "invalid_connection" };
  }

  // 3. Storage destination must exist for this Space. The restore task needs
  //    to know where to read the snapshot CSVs from. This mirrors the backup
  //    config check (which confirms storageType is accepted before enqueue).
  const storageDest = await deps.fetchStorageDestinationBySpace(
    restoreRun.spaceId,
  );
  if (!storageDest) return { ok: false, error: "storage_not_found" };

  // 4. Source backup run must exist, belong to the same space, be in a
  //    restorable terminal status (succeeded | trial_succeeded), and have a
  //    non-null startedAt. The startedAt is the `<datetime>` segment in the
  //    CSV storage path the workflows task reads from — pointing at a run
  //    without a startedAt or in a non-terminal state means the CSVs either
  //    don't exist or are incomplete.
  const sourceRun = await deps.fetchSourceRun(restoreRun.sourceRunId);
  if (!sourceRun) return { ok: false, error: "source_run_not_found" };
  if (
    sourceRun.spaceId !== restoreRun.spaceId ||
    !RESTORABLE_STATUSES.has(sourceRun.status) ||
    sourceRun.startedAt === null
  ) {
    return { ok: false, error: "source_run_not_restorable" };
  }

  // 5. Resolve the base display name. The restore task reads CSVs from the
  //    path the backup wrote:
  //      `<orgSlug>/<spaceName>/<baseName>/<datetime>/<tableName>.csv`
  //    baseName must match what the backup task recorded (at_bases.name).
  const baseName = await deps.fetchBaseName(restoreRun.scopeTarget.baseId);
  // baseName resolves to null only if the at_bases row was deleted after the
  // backup ran — treat as storage_not_found (the CSVs are unreachable anyway).
  if (baseName === null) return { ok: false, error: "storage_not_found" };

  // 6. Transition the restore run row to 'running'. This MUST happen before
  //    enqueue so observers (apps/web restore-status poll) see a non-terminal
  //    status while the task spins up.
  const startedAt = now();
  await deps.updateRestoreRunStarted(restoreRun.id, startedAt);

  // 7. Enqueue one Trigger.dev restore-base task. Unlike backup (which fans
  //    out one task per included base), restore is scoped to a single
  //    scope_target.baseId per restore_runs row — the apps/web UI creates
  //    one restore_runs row per base the user picks.
  const handle = await deps.enqueueRestoreBase({
    restoreId: restoreRun.id,
    connectionId: restoreRun.connectionId,
    sourceRunId: restoreRun.sourceRunId,
    atBaseId: restoreRun.scopeTarget.baseId,
    baseName,
    isTrial: restoreRun.isTrial,
    encryptedToken: connection.accessTokenEnc,
    // β decision: UUIDs as path placeholders until orgs/spaces mirrored.
    orgSlug: connection.organizationId,
    spaceName: restoreRun.spaceId,
    storageType: storageDest.type,
    spaceId: restoreRun.spaceId,
    scope: restoreRun.scope,
    scopeTarget: restoreRun.scopeTarget,
    // SOURCE backup run's startedAt — the `<datetime>` directory segment.
    // NOT the restore's own start time.
    sourceRunStartedAt: sourceRun.startedAt.toISOString(),
  });
  const triggerRunIds = [handle.id];

  // 8. Persist the fan-out so restores-complete (Phase C) can match per-task
  //    completions back to the restore run.
  await deps.updateRestoreRunTriggerIds(restoreRun.id, triggerRunIds);

  return { ok: true, restoreId: restoreRun.id, triggerRunIds };
}
