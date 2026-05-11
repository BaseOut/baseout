/**
 * Wire-shape types for the apps/web side of the backup-run lifecycle.
 *
 * apps/web INSERTs `backup_runs` rows in 'queued' state, then calls the
 * @baseout/server engine via the BACKUP_ENGINE service binding to fan out
 * one Trigger.dev task per included base. The engine flips status to
 * 'running'; per-base tasks call back to /api/internal/runs/:runId/complete
 * (Phase 8b) which rolls up to 'succeeded' / 'failed' / 'trial_*'.
 *
 * Result codes:
 *   - apps/web-only validation:  space_not_found, space_org_mismatch,
 *                                no_active_connection, no_bases_selected
 *   - engine pass-through:       run_not_found, run_already_started,
 *                                connection_not_found, invalid_connection,
 *                                config_not_found, unsupported_storage_type
 *   - transport / unknown:       unauthorized, engine_unreachable, engine_error
 *
 * Routes map these codes to HTTP status via mapEngineCodeToStatus
 * (with apps/web-only codes mapped inline by the route).
 */

export interface BackupRunsStartInput {
  spaceId: string;
  organizationId: string;
}

export interface BackupRunsStartSuccess {
  ok: true;
  runId: string;
  triggerRunIds: string[];
}

export type BackupRunsStartErrorCode =
  // apps/web-only — pre-engine validation
  | "space_not_found"
  | "space_org_mismatch"
  | "no_active_connection"
  | "no_bases_selected"
  // Engine pass-through (see EngineStartRunError["code"] in lib/backup-engine.ts).
  // Includes the codes the engine surfaces post-INSERT; apps/web rolls back
  // the orphaned 'queued' row before returning the error.
  | "run_not_found"
  | "run_already_started"
  | "connection_not_found"
  | "invalid_connection"
  | "config_not_found"
  | "unsupported_storage_type"
  // Transport / unknown
  | "unauthorized"
  | "engine_unreachable"
  | "engine_error";

export interface BackupRunsStartError {
  ok: false;
  code: BackupRunsStartErrorCode;
  /**
   * HTTP status the engine returned (only set for engine pass-through codes).
   * apps/web-only codes leave this undefined.
   */
  status?: number;
}

export type BackupRunsStartResult =
  | BackupRunsStartSuccess
  | BackupRunsStartError;

/**
 * Client-shape summary of a `backup_runs` row. Returned by GET
 * /api/spaces/:spaceId/backup-runs and consumed by the BackupHistoryWidget
 * (Phase 10c). Dates are ISO-8601 strings so the wire format survives
 * JSON.stringify; the store hydrates them client-side.
 */
export interface BackupRunSummary {
  id: string;
  status: string;
  isTrial: boolean;
  triggeredBy: string;
  recordCount: number | null;
  tableCount: number | null;
  attachmentCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  triggerRunIds: string[] | null;
  createdAt: string;
  /**
   * Connection used at start-time. Engine writes `connectionId` on the
   * backup_runs row; the route LEFT JOINs to surface displayName for the
   * detail panel. Null when the connection has since been deleted.
   */
  connection: { id: string; displayName: string | null } | null;
  /**
   * Space's backup configuration at fetch-time. The PRD doesn't snapshot
   * per-run, so this reflects current state. LEFT JOIN — null when no
   * configuration row exists yet.
   */
  configuration: { storageType: string; mode: string } | null;
  /**
   * Bases currently included in the Space's backup configuration. NOT a
   * per-run snapshot — engine doesn't capture that today. UI labels this
   * as "Currently selected bases" with a caveat note.
   */
  includedBases: { id: string; name: string }[];
}
