// Pure-function orchestration for the run-start flow (Phase 8a).
//
// processRunStart() validates a queued backup_run row, transitions it to
// 'running', and fans out one Trigger.dev backup-base task per included
// base. All side-effects (DB queries, task enqueue) are injected as deps —
// this mirrors the Phase 7 pattern (`runBackupBase` in trigger/tasks/
// backup-base.ts) so the validation paths are unit-testable without
// touching Postgres or Trigger.dev.
//
// Phase 8 scope decisions (captured in the plan resume note):
//   - β: orgSlug ← connection.organizationId (UUID, not slug);
//        spaceName ← run.spaceId (UUID, not name).
//        Mirroring `organizations` + `spaces` to upgrade these is a
//        tagged follow-up for a later phase.
//   - The `trial_backup_run_used && is_trial` 422 check is deliberately
//        skipped here. That column isn't in the engine's
//        backup_configurations mirror today, and the Phase 7 task
//        (runBackupBase) already enforces the trial caps at run-time
//        (5 tables / 1000 records). Add the column + the pre-enqueue
//        check together when the cleanup phase mirrors orgs/spaces.
//
// Reminders pinned in the plan:
//   - storageType: only 'r2_managed' is valid in MVP. Reject otherwise.
//     The Phase 10.4 StoragePicker UI only enables r2_managed so this
//     should never fire from the supported flow — defense-in-depth.

import type {
  BackupConfigurationRow,
  BackupRunRow,
  ConnectionRow,
} from "../../db/schema";

export interface ProcessRunStartInput {
  runId: string;
}

export interface IncludedBase {
  /** Airtable base ID, e.g. "appXXXXXXXX". */
  atBaseId: string;
  /** Display name from at_bases.name — used in the R2 path layout. */
  name: string;
}

/**
 * Wire-shape payload for the backup-base Trigger.dev task. Mirrors
 * `BackupBaseTaskPayload` in trigger/tasks/backup-base.task.ts. Re-declared
 * here (rather than imported) because the lib/runs path lives on the Worker
 * side — importing from `trigger/tasks/` would pull the Trigger.dev SDK
 * into the Worker bundle.
 */
export interface BackupBaseTaskPayload {
  runId: string;
  connectionId: string;
  atBaseId: string;
  isTrial: boolean;
  encryptedToken: string;
  orgSlug: string;
  spaceName: string;
  baseName: string;
  /** ISO-8601 string. Trigger.dev JSON-serializes payloads. */
  runStartedAt: string;
}

export interface ProcessRunStartDeps {
  fetchRunById: (runId: string) => Promise<BackupRunRow | null>;
  fetchConnectionById: (connectionId: string) => Promise<ConnectionRow | null>;
  fetchConfigBySpace: (
    spaceId: string,
  ) => Promise<BackupConfigurationRow | null>;
  fetchIncludedBases: (configId: string) => Promise<IncludedBase[]>;
  updateRunStarted: (runId: string, startedAt: Date) => Promise<void>;
  updateRunTriggerIds: (runId: string, triggerRunIds: string[]) => Promise<void>;
  enqueueBackupBase: (
    payload: BackupBaseTaskPayload,
  ) => Promise<{ id: string }>;
  /** Test seam — defaults to () => new Date() in production. */
  now?: () => Date;
}

export type ProcessRunStartResult =
  | { ok: true; runId: string; triggerRunIds: string[] }
  | {
      ok: false;
      error:
        | "run_not_found"
        | "run_already_started"
        | "connection_not_found"
        | "invalid_connection"
        | "config_not_found"
        | "unsupported_storage_type"
        | "no_bases_selected";
    };

export async function processRunStart(
  input: ProcessRunStartInput,
  deps: ProcessRunStartDeps,
): Promise<ProcessRunStartResult> {
  const now = deps.now ?? (() => new Date());

  // 1. Run row must exist and be queued.
  const run = await deps.fetchRunById(input.runId);
  if (!run) return { ok: false, error: "run_not_found" };
  if (run.status !== "queued") {
    return { ok: false, error: "run_already_started" };
  }

  // 2. Connection must exist and be active. apps/web's reconnect flow flips
  //    status to 'pending_reauth'/'invalid' when Airtable rejects the stored
  //    token; the cron-OAuth-refresh change does the same proactively.
  const connection = await deps.fetchConnectionById(run.connectionId);
  if (!connection) return { ok: false, error: "connection_not_found" };
  if (connection.status !== "active") {
    return { ok: false, error: "invalid_connection" };
  }

  // 3. Config must exist for this Space. apps/web INSERTs the config row
  //    during onboarding; missing means the user hasn't completed the
  //    storage/frequency picker yet.
  const config = await deps.fetchConfigBySpace(run.spaceId);
  if (!config) return { ok: false, error: "config_not_found" };
  if (config.storageType !== "r2_managed") {
    return { ok: false, error: "unsupported_storage_type" };
  }

  // 4. At least one base must be marked is_included=true.
  const bases = await deps.fetchIncludedBases(config.id);
  if (bases.length === 0) {
    return { ok: false, error: "no_bases_selected" };
  }

  // 5. Transition the run row to 'running'. This MUST happen before any
  //    enqueue so observers (apps/web run-history poll, future SpaceDO
  //    cron) see a non-terminal status while tasks fan out.
  const startedAt = now();
  await deps.updateRunStarted(run.id, startedAt);

  // 6. Fan out: one Trigger.dev task per included base. Sequential await
  //    (rather than Promise.all) keeps trigger_run_ids ordering deterministic
  //    and matches the order at_bases / backup_configuration_bases were
  //    selected in. At MVP-scale (~5 bases) the latency cost is negligible.
  const triggerRunIds: string[] = [];
  const runStartedAtIso = startedAt.toISOString();
  for (const base of bases) {
    const handle = await deps.enqueueBackupBase({
      runId: run.id,
      connectionId: run.connectionId,
      atBaseId: base.atBaseId,
      isTrial: run.isTrial,
      encryptedToken: connection.accessTokenEnc,
      // β decision: UUIDs as path placeholders until orgs/spaces mirrored.
      orgSlug: connection.organizationId,
      spaceName: run.spaceId,
      baseName: base.name,
      runStartedAt: runStartedAtIso,
    });
    triggerRunIds.push(handle.id);
  }

  // 7. Persist the fan-out so run-complete (Phase 8b) can match per-task
  //    completions back to the run.
  await deps.updateRunTriggerIds(run.id, triggerRunIds);

  return { ok: true, runId: run.id, triggerRunIds };
}
