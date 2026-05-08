// Pure-function orchestration for the run-complete callback (Phase 8b).
//
// processRunComplete() consumes one per-base callback from a Trigger.dev
// backup-base task, applies the per-base counts atomically to the
// backup_runs row, and — on the last outstanding callback — finalizes
// the run's overall status and completed_at.
//
// All side-effects (DB queries) are injected as deps. This mirrors the
// Phase 7 / 8a pattern (`runBackupBase`, `processRunStart`) so the
// state-machine logic is unit-testable without Postgres.
//
// Idempotency design (Option J — no master-DB schema change):
//   - Phase 8a's `processRunStart` writes `trigger_run_ids = [run_a, run_b, ...]`
//     after fanning out N tasks.
//   - Each per-base callback identifies itself by Trigger.dev's run ID
//     (ctx.run.id from the wrapper). The route handler implements
//     applyPerBaseCompletion as an atomic SQL UPDATE that:
//       (a) Removes triggerRunId from trigger_run_ids (jsonb minus operator).
//       (b) Increments record_count, table_count, attachment_count by the
//           body's deltas.
//       (c) Stickily sets error_message on first failure (CASE-WHEN pattern).
//       (d) Returns the post-update remainingCount + hasFailure flag.
//   - If the WHERE clause's `trigger_run_ids ? :triggerRunId` check fails
//     (because a previous callback already removed it), the UPDATE returns
//     zero rows and applyPerBaseCompletion resolves to null. We treat that
//     as a 200-noop replay — Trigger.dev v3 retries can otherwise
//     double-count.
//   - When remainingCount === 0, this function decides the final status
//     (priority: hasFailure > input.status) and calls finalizeRun, which
//     sets status + completed_at.
//
// Final-status priority on the last callback:
//   hasFailure → 'failed'
//   else input.status === 'trial_complete' → 'trial_complete'
//   else input.status === 'trial_truncated' → 'trial_truncated'
//   else → 'succeeded'
// This is good enough for MVP. With multiple bases reporting different
// trial statuses, the LAST callback's hint wins; an explicit
// "worst trial state seen" tracker would need a new column. Cleanup
// follow-up is tagged in the plan alongside the orgs/spaces mirror.

export type BackupBaseStatus =
  | "succeeded"
  | "trial_truncated"
  | "trial_complete"
  | "failed";

export type FinalRunStatus =
  | "succeeded"
  | "failed"
  | "trial_complete"
  | "trial_truncated";

export interface ProcessRunCompleteInput {
  runId: string;
  triggerRunId: string;
  atBaseId: string;
  status: BackupBaseStatus;
  tablesProcessed: number;
  recordsProcessed: number;
  attachmentsProcessed: number;
  errorMessage?: string;
}

export interface ApplyPerBaseCompletionInput {
  runId: string;
  triggerRunId: string;
  tablesProcessed: number;
  recordsProcessed: number;
  attachmentsProcessed: number;
  /** Non-null only when input.status === 'failed'. Sticky write — the SQL UPDATE keeps the FIRST non-null error_message. */
  failureMessage: string | null;
}

export interface ProcessRunCompleteDeps {
  /** 404 gate. Returns null if the row doesn't exist. */
  fetchRunById: (runId: string) => Promise<{ id: string } | null>;
  /**
   * Atomic per-base completion. Returns null if triggerRunId wasn't in
   * trigger_run_ids (idempotent replay). Otherwise returns the row's
   * post-update remainingCount + hasFailure flag.
   */
  applyPerBaseCompletion: (
    input: ApplyPerBaseCompletionInput,
  ) => Promise<{ remainingCount: number; hasFailure: boolean } | null>;
  /** Sets status + completed_at. Called only when remainingCount === 0. */
  finalizeRun: (input: {
    runId: string;
    finalStatus: FinalRunStatus;
    completedAt: Date;
  }) => Promise<void>;
  /** Test seam — defaults to () => new Date() in production. */
  now?: () => Date;
}

export type ProcessRunCompleteResult =
  | { ok: true; kind: "noop" }
  | { ok: true; kind: "partial"; remainingCount: number }
  | { ok: true; kind: "finalized"; finalStatus: FinalRunStatus }
  | { ok: false; error: "run_not_found" };

export async function processRunComplete(
  input: ProcessRunCompleteInput,
  deps: ProcessRunCompleteDeps,
): Promise<ProcessRunCompleteResult> {
  const now = deps.now ?? (() => new Date());

  // 1. Run row must exist. The route handler returns 404 for this case.
  const run = await deps.fetchRunById(input.runId);
  if (!run) return { ok: false, error: "run_not_found" };

  // 2. Apply atomic per-base completion. failureMessage is only sent on
  //    'failed' so the SQL CASE-WHEN can keep the FIRST failure's message.
  const failureMessage =
    input.status === "failed"
      ? (input.errorMessage ?? "unknown_failure")
      : null;
  const applied = await deps.applyPerBaseCompletion({
    runId: input.runId,
    triggerRunId: input.triggerRunId,
    tablesProcessed: input.tablesProcessed,
    recordsProcessed: input.recordsProcessed,
    attachmentsProcessed: input.attachmentsProcessed,
    failureMessage,
  });

  // 3. Replay — triggerRunId already removed from the array by an earlier
  //    callback. Trigger.dev v3 may retry on transient transport errors;
  //    return 200-shape so the runner doesn't keep retrying.
  if (applied === null) return { ok: true, kind: "noop" };

  // 4. Other bases are still outstanding; don't finalize yet.
  if (applied.remainingCount > 0) {
    return { ok: true, kind: "partial", remainingCount: applied.remainingCount };
  }

  // 5. Last callback. Compute final status (failure beats trial beats success).
  let finalStatus: FinalRunStatus;
  if (applied.hasFailure) {
    finalStatus = "failed";
  } else if (input.status === "trial_complete") {
    finalStatus = "trial_complete";
  } else if (input.status === "trial_truncated") {
    finalStatus = "trial_truncated";
  } else {
    finalStatus = "succeeded";
  }

  await deps.finalizeRun({
    runId: input.runId,
    finalStatus,
    completedAt: now(),
  });

  return { ok: true, kind: "finalized", finalStatus };
}
