// Pure-function orchestration for the run-delete route (Phase C.1 of
// openspec/changes/shared-backup-run-delete).
//
// processRunDelete() validates a terminal backup_runs row, computes the
// per-base storage prefixes that the delete-run-files Trigger.dev task
// will need, and atomically transitions the row to 'deleting' via a CAS
// UPDATE. All side-effects (DB queries) are injected as deps so the
// state-machine logic is unit-testable without Postgres.
//
// Critically, computeRunPrefixes runs BEFORE markRunDeleting so a DB
// failure during prefix computation leaves the row unchanged — the
// CAS only fires after we have the data the task will need. The thrown
// error bubbles to the route, which maps to a 500.
//
// Error mapping (route handler maps these to HTTP):
//   ok                          → 202  { ok: true, prefixes, storageType }
//   run_not_found               → 404
//   run_not_terminal            → 409  (queued | running | cancelling — user
//                                       must Cancel first if applicable)
//   delete_in_progress          → 409  (status already 'deleting' OR CAS
//                                       lost the race vs concurrent delete)
//
// Terminal action (row hard-DELETE) is NOT performed by this function — it
// happens in /api/internal/runs/:runId/delete-complete after the workflows
// task POSTs back with ok:true. See design.md.

export interface ProcessRunDeleteInput {
  runId: string;
}

export interface DeletableRun {
  id: string;
  status: string;
}

export interface RunPrefixesAndStorage {
  prefixes: string[];
  storageType: string;
}

export interface ProcessRunDeleteDeps {
  /**
   * 404 gate. Returns null if the row doesn't exist. Reads (id, status)
   * from baseout.backup_runs.
   */
  fetchRunForDelete: (runId: string) => Promise<DeletableRun | null>;
  /**
   * Compute the per-base storage prefixes for this run + the storage_type
   * the delete task should resolve against. SELECTs from
   * backup_runs → spaces → organizations → backup_configuration_bases →
   * at_bases. Returns `{ prefixes: [] }` if no bases are joined — the
   * task DELETE path handles that as a metadata-only delete.
   *
   * Throws on transactional / connectivity errors. The caller does NOT
   * catch — the route maps a throw to 500.
   */
  computeRunPrefixes: (runId: string) => Promise<RunPrefixesAndStorage>;
  /**
   * CAS UPDATE: status='deleting', modified_at=now() WHERE id=$1
   * AND status IN ('succeeded','failed','cancelled','trial_complete','trial_truncated').
   * Returns true if exactly one row was updated (we won the race), false
   * otherwise (concurrent delete won OR a status change snuck in).
   */
  markRunDeleting: (runId: string) => Promise<boolean>;
}

export type ProcessRunDeleteResult =
  | { ok: true; prefixes: string[]; storageType: string }
  | {
      ok: false;
      error: "run_not_found" | "run_not_terminal" | "delete_in_progress";
    };

const TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "trial_complete",
  "trial_truncated",
]);

export async function processRunDelete(
  input: ProcessRunDeleteInput,
  deps: ProcessRunDeleteDeps,
): Promise<ProcessRunDeleteResult> {
  // 1. Row must exist.
  const run = await deps.fetchRunForDelete(input.runId);
  if (!run) return { ok: false, error: "run_not_found" };

  // 2. Already-deleting short-circuit before any other work. Catches the
  //    double-click without firing extra DB reads.
  if (run.status === "deleting") {
    return { ok: false, error: "delete_in_progress" };
  }

  // 3. Must be a terminal status. queued | running | cancelling all map to
  //    'not_terminal' — the user must Cancel first if applicable.
  if (!TERMINAL_STATUSES.has(run.status)) {
    return { ok: false, error: "run_not_terminal" };
  }

  // 4. Compute prefixes BEFORE the CAS so a DB failure here leaves the
  //    row unchanged. computeRunPrefixes is the join-heavy query; if it
  //    throws, the caller (route) maps to 500 and the row stays terminal.
  const { prefixes, storageType } = await deps.computeRunPrefixes(run.id);

  // 5. CAS to 'deleting'. Atomic with WHERE status IN (<terminal>); the
  //    loser of a concurrent-delete race returns false here.
  const won = await deps.markRunDeleting(run.id);
  if (!won) return { ok: false, error: "delete_in_progress" };

  return { ok: true, prefixes, storageType };
}
