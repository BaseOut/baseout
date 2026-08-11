// Pure-function orchestration for the run-cancel route (Phase 8.cancel).
//
// processRunCancel() validates a backup_runs row, atomically transitions
// it from {queued | running} → 'cancelling' via a CAS UPDATE, asks
// Trigger.dev to cancel each outstanding triggerRunId, then flips the row
// to 'cancelled' (terminal). All side-effects (DB queries, Trigger.dev
// SDK call) are injected as deps so the state-machine logic is
// unit-testable without Postgres or @trigger.dev/sdk.
//
// Cancellation is best-effort on the Trigger.dev side: any per-task
// rejection is logged + swallowed by the dep, so the run still flips to
// terminal. The actual task receives an AbortError on its next await
// point; the existing apps/workflows backup-base.task.ts outer try/catch handles that as
// a regular failure and POSTs to /complete, which no-ops against a
// terminal row.
//
// Error mapping (route handler maps these to HTTP):
//   ok                          → 200  { ok: true, cancelledTriggerRunIds }
//   run_not_found               → 404
//   run_already_terminal        → 409  (covers actual terminal statuses
//                                       AND the CAS-loss race against a
//                                       concurrent cancel)
//
// Idempotency:
//   - A second concurrent cancel hits the CAS in markRunCancelling. The
//     first wins (returns true); the second's UPDATE matches no rows and
//     returns false → mapped to run_already_terminal (409).
//   - A repeat cancel after the run is already 'cancelled' / 'cancelling'
//     is caught by the up-front status check and short-circuits before the
//     CAS — same 409 result, no Trigger.dev SDK calls fired.

export interface ProcessRunCancelInput {
  runId: string;
}

export interface CancellableRun {
  id: string;
  status: string;
  triggerRunIds: string[] | null;
}

export interface ProcessRunCancelDeps {
  /**
   * 404 gate. Returns null if the row doesn't exist. Reads
   * (id, status, trigger_run_ids) from baseout.backup_runs.
   */
  fetchRunForCancel: (runId: string) => Promise<CancellableRun | null>;
  /**
   * CAS UPDATE: status='cancelling', modified_at=now() WHERE id=$1 AND
   * status IN ('queued','running'). Returns true if exactly one row was
   * updated (we won the race), false otherwise (concurrent cancel won).
   */
  markRunCancelling: (runId: string) => Promise<boolean>;
  /**
   * Asks Trigger.dev to cancel a single fanned-out task. Best-effort —
   * the dep is expected to log + swallow internally; throws bubble up so
   * the pure function can decide how to treat them. The function as
   * currently implemented swallows them and continues, so passing a
   * non-throwing dep is equivalent for production wiring.
   */
  cancelTriggerRun: (triggerRunId: string) => Promise<void>;
  /**
   * Final UPDATE: status='cancelled', completed_at=$completedAt,
   * modified_at=$completedAt WHERE id=$runId AND status='cancelling'.
   * No CAS guard return — we already won the cancelling CAS.
   */
  markRunCancelled: (input: { runId: string; completedAt: Date }) => Promise<void>;
  /** Test seam — defaults to () => new Date() in production. */
  now?: () => Date;
}

export type ProcessRunCancelResult =
  | { ok: true; cancelledTriggerRunIds: string[] }
  | { ok: false; error: "run_not_found" | "run_already_terminal" };

const ACTIVE_STATUSES = new Set(["queued", "running"]);

export async function processRunCancel(
  input: ProcessRunCancelInput,
  deps: ProcessRunCancelDeps,
): Promise<ProcessRunCancelResult> {
  const now = deps.now ?? (() => new Date());

  // 1. Run row must exist.
  const run = await deps.fetchRunForCancel(input.runId);
  if (!run) return { ok: false, error: "run_not_found" };

  // 2. Short-circuit when the row is already terminal OR already
  //    cancelling. Avoids firing redundant Trigger.dev SDK calls on a
  //    double-clicked cancel button.
  if (!ACTIVE_STATUSES.has(run.status)) {
    return { ok: false, error: "run_already_terminal" };
  }

  // 3. CAS to 'cancelling'. Atomic with WHERE status IN ('queued',
  //    'running'); loser of a concurrent-cancel race returns false here.
  const won = await deps.markRunCancelling(run.id);
  if (!won) return { ok: false, error: "run_already_terminal" };

  // 4. Best-effort Trigger.dev cancellation. Swallow per-id errors so a
  //    Trigger.dev transient outage doesn't strand the run in 'cancelling'.
  const triggerRunIds = run.triggerRunIds ?? [];
  for (const triggerRunId of triggerRunIds) {
    try {
      await deps.cancelTriggerRun(triggerRunId);
    } catch {
      // Intentional swallow — the dep is expected to have its own logger;
      // the pure function only cares about reaching terminal state. The
      // actual task may still report into /complete via the existing
      // failure-handling code, which no-ops against a terminal row.
    }
  }

  // 5. Terminal write.
  await deps.markRunCancelled({ runId: run.id, completedAt: now() });

  return { ok: true, cancelledTriggerRunIds: triggerRunIds };
}
