// Pure-function orchestration for the restore-cancel route (server-restore Phase D).
//
// processRestoreCancel() validates a restore_runs row, atomically transitions
// it from {queued | running} → 'cancelling' via a CAS UPDATE, asks
// Trigger.dev to cancel each outstanding triggerRunId, then flips the row
// to 'cancelled' (terminal). All side-effects (DB queries, Trigger.dev
// SDK call) are injected as deps so the state-machine logic is
// unit-testable without Postgres or @trigger.dev/sdk.
//
// Mirrors processRunCancel (src/lib/runs/cancel.ts) exactly, adapted for
// restore_runs: the dep names use "Restore" and the terminal timestamp
// column is cancelled_at (vs completed_at for backup_runs).
//
// Cancellation is best-effort on the Trigger.dev side: any per-task
// rejection is logged + swallowed by the dep, so the restore still flips
// to terminal. The actual task receives an AbortError on its next await
// point; the workflows-restore outer try/catch handles that as a failure
// and POSTs to /complete, which no-ops against a terminal row.
//
// Error mapping (route handler maps these to HTTP):
//   ok                             → 200  { ok: true, cancelledTriggerRunIds }
//   restore_not_found              → 404
//   restore_already_terminal       → 409  (covers actual terminal statuses
//                                          AND the CAS-loss race against a
//                                          concurrent cancel)

export interface ProcessRestoreCancelInput {
  restoreId: string;
}

export interface CancellableRestore {
  id: string;
  status: string;
  triggerRunIds: string[] | null;
}

export interface ProcessRestoreCancelDeps {
  /**
   * 404 gate. Returns null if the row doesn't exist. Reads
   * (id, status, trigger_run_ids) from baseout.restore_runs.
   */
  fetchRestoreForCancel: (restoreId: string) => Promise<CancellableRestore | null>;
  /**
   * CAS UPDATE: status='cancelling', modified_at=now() WHERE id=$1 AND
   * status IN ('queued','running'). Returns true if exactly one row was
   * updated (we won the race), false otherwise (concurrent cancel won).
   */
  markRestoreCancelling: (restoreId: string) => Promise<boolean>;
  /**
   * Asks Trigger.dev to cancel a single fanned-out task. Best-effort —
   * the dep is expected to log + swallow internally; throws bubble up so
   * the pure function can decide how to treat them. The function as
   * currently implemented swallows them and continues.
   */
  cancelTriggerRun: (triggerRunId: string) => Promise<void>;
  /**
   * Final UPDATE: status='cancelled', cancelled_at=$cancelledAt,
   * modified_at=$cancelledAt WHERE id=$restoreId AND status='cancelling'.
   * No CAS guard return — we already won the cancelling CAS.
   *
   * Note: restore_runs uses cancelled_at (not completed_at) for the cancel
   * timestamp — see design.md schema. Mirrors the column added in Phase A.
   */
  markRestoreCancelled: (input: {
    restoreId: string;
    cancelledAt: Date;
  }) => Promise<void>;
  /** Test seam — defaults to () => new Date() in production. */
  now?: () => Date;
}

export type ProcessRestoreCancelResult =
  | { ok: true; cancelledTriggerRunIds: string[] }
  | { ok: false; error: "restore_not_found" | "restore_already_terminal" };

const ACTIVE_STATUSES = new Set(["queued", "running"]);

export async function processRestoreCancel(
  input: ProcessRestoreCancelInput,
  deps: ProcessRestoreCancelDeps,
): Promise<ProcessRestoreCancelResult> {
  const now = deps.now ?? (() => new Date());

  // 1. Restore row must exist.
  const restore = await deps.fetchRestoreForCancel(input.restoreId);
  if (!restore) return { ok: false, error: "restore_not_found" };

  // 2. Short-circuit when the row is already terminal OR already
  //    cancelling. Avoids firing redundant Trigger.dev SDK calls on a
  //    double-clicked cancel button.
  if (!ACTIVE_STATUSES.has(restore.status)) {
    return { ok: false, error: "restore_already_terminal" };
  }

  // 3. CAS to 'cancelling'. Atomic with WHERE status IN ('queued',
  //    'running'); loser of a concurrent-cancel race returns false here.
  const won = await deps.markRestoreCancelling(restore.id);
  if (!won) return { ok: false, error: "restore_already_terminal" };

  // 4. Best-effort Trigger.dev cancellation. Swallow per-id errors so a
  //    Trigger.dev transient outage doesn't strand the restore in 'cancelling'.
  const triggerRunIds = restore.triggerRunIds ?? [];
  for (const triggerRunId of triggerRunIds) {
    try {
      await deps.cancelTriggerRun(triggerRunId);
    } catch {
      // Intentional swallow — the dep is expected to have its own logger;
      // the pure function only cares about reaching terminal state.
    }
  }

  // 5. Terminal write. Uses cancelled_at (restore_runs column) vs
  //    completed_at (backup_runs column) — see design.md schema.
  await deps.markRestoreCancelled({ restoreId: restore.id, cancelledAt: now() });

  return { ok: true, cancelledTriggerRunIds: triggerRunIds };
}
