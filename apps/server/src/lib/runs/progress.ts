// Pure-function orchestration for the run-progress callback (Phase 10d).
//
// processRunProgress() consumes one fire-and-forget event from a Trigger.dev
// backup-base task — typically posted after each table-page upload succeeds
// and once more at end-of-table — and bumps the backup_runs row's counters
// so the frontend's 2s poll can render a live "Backing up… N records" label.
//
// All side-effects (the atomic SQL UPDATE) are injected as deps. Mirrors the
// Phase 7 / 8a / 8b pattern (runBackupBase / processRunStart / processRun-
// Complete) so the state-machine logic is unit-testable without Postgres.
//
// Design (no schema change — reuses record_count / table_count columns):
//   - applyProgress is one dep. The route wires it to a CTE that returns
//     two booleans:
//       (a) exists=false                  → 404 run_not_found
//       (b) exists=true,  updated=false   → 200 noop  (row exists but the
//                                            status='running' guard didn't
//                                            match — /complete already
//                                            flipped status to terminal)
//       (c) exists=true,  updated=true    → 200 applied
//   - triggerRunId + atBaseId are accepted on the input for tracing /
//     observability but are NOT forwarded to the dep. Counter bumps are
//     advisory; /complete is the authoritative writer that overwrites the
//     per-base totals when the base finishes.
//
// Late/retried events: Trigger.dev page retries may double-count records
// briefly. /complete corrects this by overwriting with the final totals.
// Acceptable mid-flight drift; documented in the plan as out-of-scope to
// strictly idempotency-key per-page progress.

export interface ProcessRunProgressInput {
  runId: string;
  /** Advisory — for tracing only. Not forwarded to the dep. */
  triggerRunId: string;
  /** Advisory — for tracing only. Not forwarded to the dep. */
  atBaseId: string;
  /** Number of records uploaded by this page. Must be a non-negative integer. */
  recordsAppended: number;
  /** True when this event marks end-of-table; bumps table_count by 1. */
  tableCompleted: boolean;
}

export interface ApplyProgressInput {
  runId: string;
  recordsAppended: number;
  tableCompleted: boolean;
}

export interface ApplyProgressResult {
  /** True iff a row with id=runId exists at all. */
  exists: boolean;
  /** True iff the row existed AND its status was 'running' when the UPDATE fired. */
  updated: boolean;
}

export interface ProcessRunProgressDeps {
  applyProgress: (input: ApplyProgressInput) => Promise<ApplyProgressResult>;
}

export type ProcessRunProgressResult =
  | { ok: true; kind: "applied" }
  | { ok: true; kind: "noop" }
  | { ok: false; error: "run_not_found" };

export async function processRunProgress(
  input: ProcessRunProgressInput,
  deps: ProcessRunProgressDeps,
): Promise<ProcessRunProgressResult> {
  const { exists, updated } = await deps.applyProgress({
    runId: input.runId,
    recordsAppended: input.recordsAppended,
    tableCompleted: input.tableCompleted,
  });

  if (!exists) return { ok: false, error: "run_not_found" };
  if (!updated) return { ok: true, kind: "noop" };
  return { ok: true, kind: "applied" };
}
