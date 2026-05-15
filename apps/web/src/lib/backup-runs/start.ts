/**
 * Pure orchestration for "user clicks Run backup now" (Phase 9).
 *
 * Mirrors the @baseout/server processRunStart pattern (see
 * apps/server/src/lib/runs/start.ts): all side-effects (DB queries, engine
 * call) injected as deps so validation paths are unit-testable without
 * touching Postgres or the BACKUP_ENGINE binding. The route wires real
 * Drizzle queries + a real BackupEngineClient and calls startBackupRun().
 *
 * Flow:
 *   1. Validate space + org (IDOR).
 *   2. Find an Airtable connection in the org; reject if none / not active.
 *   3. Pre-check at least one base is included (saves the engine call when
 *      the wizard wasn't completed).
 *   4. INSERT a 'queued' backup_runs row.
 *   5. Call engine.startRun(runId).
 *   6. Engine ok → return {runId, triggerRunIds}.
 *      Engine err → DELETE the orphaned row, return the engine code.
 *
 * Trial flag: `is_trial=false` for MVP. The engine task enforces a runtime
 * cap regardless of the flag for trial users (TRIAL_RECORD_CAP=1000,
 * TRIAL_TABLE_CAP=5 in apps/workflows/trigger/tasks/backup-base.ts), but for
 * accuracy a follow-up should resolve trial state from subscription_items.
 * TODO(trial): set is_trial from subscriptionItems.trialEndsAt > now().
 */

import type {
  BackupRunsStartInput,
  BackupRunsStartResult,
} from "./types";
import type { EngineStartRunResult } from "../backup-engine";

/**
 * Slim Space row — only the fields the helper needs. Keeps the dep type
 * narrow so tests don't have to fabricate the full Drizzle row.
 */
export interface SpaceRow {
  id: string;
  organizationId: string;
}

/**
 * Slim Connection row — only the fields the helper needs.
 */
export interface ConnectionRow {
  id: string;
  organizationId: string;
  status: string;
}

export interface InsertBackupRunInput {
  spaceId: string;
  connectionId: string;
  isTrial: boolean;
}

export interface StartBackupRunDeps {
  fetchSpaceById: (spaceId: string) => Promise<SpaceRow | null>;
  /** Returns the most-relevant Airtable connection in the org, regardless of status. */
  fetchAirtableConnection: (
    organizationId: string,
  ) => Promise<ConnectionRow | null>;
  countIncludedBases: (spaceId: string) => Promise<number>;
  insertBackupRun: (input: InsertBackupRunInput) => Promise<string>;
  deleteBackupRun: (runId: string) => Promise<void>;
  engineStartRun: (runId: string) => Promise<EngineStartRunResult>;
}

export async function startBackupRun(
  input: BackupRunsStartInput,
  deps: StartBackupRunDeps,
): Promise<BackupRunsStartResult> {
  // 1. IDOR-safe space fetch. We distinguish space_not_found (no row at
  //    all) from space_org_mismatch (row in another org) so logs/metrics
  //    can tell them apart; the route maps both to 403 so the response
  //    doesn't leak whether a space exists in another org.
  const space = await deps.fetchSpaceById(input.spaceId);
  if (!space) return { ok: false, code: "space_not_found" };
  if (space.organizationId !== input.organizationId) {
    return { ok: false, code: "space_org_mismatch" };
  }

  // 2. Connection fetch — returns any Airtable connection in the org.
  //    null → no connection at all (user hasn't connected Airtable);
  //    status !== 'active' → connection exists but needs reconnect.
  const connection = await deps.fetchAirtableConnection(input.organizationId);
  if (!connection) return { ok: false, code: "no_active_connection" };
  if (connection.status !== "active") {
    return { ok: false, code: "invalid_connection" };
  }

  // 3. Pre-check: at least one base is_included. Saves an engine round
  //    trip when the user hasn't finished wizard step 2.
  const baseCount = await deps.countIncludedBases(input.spaceId);
  if (baseCount === 0) return { ok: false, code: "no_bases_selected" };

  // 4. INSERT the 'queued' row. From here, any failure path needs to
  //    DELETE this row to avoid orphaned rows polluting backup history.
  const runId = await deps.insertBackupRun({
    spaceId: input.spaceId,
    connectionId: connection.id,
    isTrial: false,
  });

  // 5. Hand off to the engine.
  const engineResult = await deps.engineStartRun(runId);
  if (engineResult.ok) {
    return {
      ok: true,
      runId: engineResult.runId,
      triggerRunIds: engineResult.triggerRunIds,
    };
  }

  // 6. Engine rejected — undo the INSERT so the user can retry. Swallow
  //    any DELETE failure (transient master-DB error etc.); a sweeper can
  //    clean up later. Surfacing the DELETE error here would mask the real
  //    engine error from the user.
  try {
    await deps.deleteBackupRun(runId);
  } catch {
    // intentional — see the comment above
  }

  return {
    ok: false,
    code: engineResult.code,
    status: engineResult.status,
  };
}
