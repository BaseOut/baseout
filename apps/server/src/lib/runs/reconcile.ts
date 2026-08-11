// Run reconciliation — PURE decision (server-run-reconciliation), the
// "Phase 11" safety net long promised by comments in start.ts and the task
// wrapper. Terminalizes backup/restore runs whose Trigger.dev tasks all
// reached a terminal state without ever reporting completion, so no run can
// sit in 'running' forever (2026-07-14: dev-TTL-expired tasks stranded a run
// indefinitely).
//
// Ground truth (pinned by runs-reconcile.test.ts): `trigger_run_ids` is a
// PENDING-completions set — /complete removes each id as its per-base
// completion lands and finalizeRun fires at []. Therefore:
//   - ids present  → these tasks never completed; ask Trigger.dev about THEM.
//   - []           → every completion landed but finalizeRun crashed →
//                    recover the intended final status from error_message
//                    (sticky COALESCE set by per-base failures).
//   - null         → processRunStart died before recording the fan-out;
//                    tasks may exist untracked → only fail after a LONGER
//                    window.
//
// Trigger.dev v3 run statuses (task 1.2; verified against the v3 API +
// observed live: QUEUED, EXECUTING, COMPLETED, EXPIRED): terminal =
// COMPLETED | CANCELED | FAILED | CRASHED | SYSTEM_FAILURE | EXPIRED |
// TIMED_OUT | INTERRUPTED. Anything unrecognized is treated as ACTIVE (leave
// the run alone) so a future status can never cause a false terminalization.

export const TERMINAL_TRIGGER_STATUSES: ReadonlySet<string> = new Set([
  "COMPLETED",
  "CANCELED",
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "EXPIRED",
  "TIMED_OUT",
  "INTERRUPTED",
]);

export interface ReconcileRun {
  id: string;
  /** queued | running — the sweep's SELECT guarantees non-terminal. */
  status: string;
  startedAt: Date | null;
  createdAt: Date;
  /** Sticky per-base failure message (COALESCE'd by /complete). */
  errorMessage: string | null;
  /** Pending Trigger.dev run ids; null = fan-out never recorded. */
  triggerRunIds: string[] | null;
}

export type ReconcileDecision =
  | { action: "leave"; reason: string }
  | { action: "fail"; errorMessage: string }
  /** [] pending set: completions all landed, finalize crashed — finish the job. */
  | { action: "finalize"; finalStatus: "succeeded" | "failed" };

/** Runs younger than this are never touched (tasks may simply be slow). */
export const RECONCILE_GRACE_MS = 15 * 60_000;
/** null trigger_run_ids: untracked tasks might exist — wait much longer. */
export const RECONCILE_NO_TASKS_GRACE_MS = 60 * 60_000;

export function decideReconciliation(
  run: ReconcileRun,
  /** Trigger.dev statuses aligned to run.triggerRunIds; null = lookup failed. */
  taskStatuses: (string | null)[],
  now: Date,
): ReconcileDecision {
  const anchor = run.startedAt ?? run.createdAt;
  const ageMs = now.getTime() - anchor.getTime();
  if (ageMs < RECONCILE_GRACE_MS) return { action: "leave", reason: "grace_window" };

  // Empty/null pending set. The []→finalize recovery only holds for RUNNING
  // rows (completions all landed, finalizeRun crashed). A 'queued' row with
  // an empty set is a run whose fan-out never happened — restore_runs even
  // DEFAULTS to '{}' at insert — so it takes the no-tasks path instead.
  const noTasks =
    run.triggerRunIds === null ||
    (run.triggerRunIds.length === 0 && run.status === "queued");
  if (noTasks) {
    if (ageMs < RECONCILE_NO_TASKS_GRACE_MS) {
      return { action: "leave", reason: "no_tasks_recorded_grace" };
    }
    return {
      action: "fail",
      errorMessage: "reconciled: no tasks recorded for this run (fan-out never persisted)",
    };
  }

  if (run.triggerRunIds!.length === 0) {
    return {
      action: "finalize",
      finalStatus: run.errorMessage ? "failed" : "succeeded",
    };
  }

  if (taskStatuses.some((s) => s === null)) {
    return { action: "leave", reason: "task_state_unknown" };
  }
  if (taskStatuses.some((s) => !TERMINAL_TRIGGER_STATUSES.has(s!))) {
    return { action: "leave", reason: "tasks_active" };
  }

  const counts = new Map<string, number>();
  for (const s of taskStatuses) counts.set(s!, (counts.get(s!) ?? 0) + 1);
  const summary = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, n]) => `${state} x${n}`)
    .join(", ");
  return {
    action: "fail",
    errorMessage: `reconciled: tasks terminal without completion (${summary})`,
  };
}
