// Pure-function orchestration for the restore-progress callback (server-restore Phase C.2).
//
// processRestoreProgress() consumes one fire-and-forget event from a Trigger.dev
// restore-base task — posted after each table-page restore succeeds and once more
// at end-of-table — and bumps the restore_runs row's counters so the frontend's
// 2s poll can render a live "Restoring… N records" label.
//
// All side-effects (the atomic SQL UPDATE) are injected as deps. Mirrors
// processRunProgress (src/lib/runs/progress.ts) for the restore lifecycle.
//
// Design (mirrors the backup progress design):
//   - applyProgress is one dep. The route wires it to a CTE that returns
//     two booleans:
//       (a) exists=false                  → 404 restore_not_found
//       (b) exists=true,  updated=false   → 200 noop  (row exists but the
//                                            status='running' guard didn't
//                                            match — /complete already
//                                            flipped status to terminal)
//       (c) exists=true,  updated=true    → 200 applied
//   - triggerRunId + atBaseId are accepted on the input for tracing /
//     observability but are NOT forwarded to the dep. Counter bumps are
//     advisory; /complete is the authoritative writer that overwrites the
//     per-base totals when the base finishes.

export interface ProcessRestoreProgressInput {
  restoreId: string;
  /** Advisory — for tracing only. Not forwarded to the dep. */
  triggerRunId: string;
  /** Advisory — for tracing only. Not forwarded to the dep. */
  atBaseId: string;
  /** Number of records restored by this page. Must be a non-negative integer. */
  recordsAppended: number;
  /** True when this event marks end-of-table; bumps tables_restored by 1. */
  tableCompleted: boolean;
}

export interface ApplyRestoreProgressInput {
  restoreId: string;
  recordsAppended: number;
  tableCompleted: boolean;
}

export interface ApplyRestoreProgressResult {
  /** True iff a row with id=restoreId exists at all. */
  exists: boolean;
  /** True iff the row existed AND its status was 'running' when the UPDATE fired. */
  updated: boolean;
}

export interface ProcessRestoreProgressDeps {
  applyProgress: (
    input: ApplyRestoreProgressInput,
  ) => Promise<ApplyRestoreProgressResult>;
}

export type ProcessRestoreProgressResult =
  | { ok: true; kind: "applied" }
  | { ok: true; kind: "noop" }
  | { ok: false; error: "restore_not_found" };

export async function processRestoreProgress(
  input: ProcessRestoreProgressInput,
  deps: ProcessRestoreProgressDeps,
): Promise<ProcessRestoreProgressResult> {
  const { exists, updated } = await deps.applyProgress({
    restoreId: input.restoreId,
    recordsAppended: input.recordsAppended,
    tableCompleted: input.tableCompleted,
  });

  if (!exists) return { ok: false, error: "restore_not_found" };
  if (!updated) return { ok: true, kind: "noop" };
  return { ok: true, kind: "applied" };
}
