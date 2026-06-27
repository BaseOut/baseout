// Pure-function orchestration for the restore-complete callback (server-restore Phase C.4).
//
// processRestoreComplete() consumes one per-base callback from a Trigger.dev
// restore-base task, applies the per-base counts atomically to the
// restore_runs row, and — on the last outstanding callback — finalizes
// the restore's overall status and completed_at.
//
// All side-effects (DB queries) are injected as deps. Mirrors processRunComplete
// (src/lib/runs/complete.ts) adapted for the restore lifecycle.
//
// Differences from processRunComplete:
//   - Status set: 'succeeded' | 'failed' only (no trial states).
//   - Column names: tablesRestored / recordsRestored / attachmentsRestored.
//   - trigger_run_ids is a Postgres text[] (not jsonb) — the SQL array
//     operators differ (array_remove vs jsonb minus, cardinality vs
//     jsonb_array_length); the pure function is identical but the route's
//     dep implementations use the text[] variants.
//
// Idempotency design (mirrors Option J — no extra schema change):
//   - applyPerBaseCompletion atomically removes triggerRunId from
//     trigger_run_ids (array_remove), increments counters, stickily sets
//     error_message, returns { remainingCount, hasFailure }.
//   - If WHERE trigger_run_ids @> ARRAY[triggerRunId] fails (already removed),
//     UPDATE returns zero rows → applyPerBaseCompletion resolves to null → noop.
//   - When remainingCount === 0, finalizes: hasFailure → 'failed'; else → 'succeeded'.

export type RestoreBaseStatus = "succeeded" | "failed";

export type FinalRestoreStatus = "succeeded" | "failed";

export interface ProcessRestoreCompleteInput {
  restoreId: string;
  triggerRunId: string;
  atBaseId: string;
  status: RestoreBaseStatus;
  tablesRestored: number;
  recordsRestored: number;
  attachmentsRestored: number;
  errorMessage?: string;
}

export interface ApplyPerBaseRestoreCompletionInput {
  restoreId: string;
  triggerRunId: string;
  tablesRestored: number;
  recordsRestored: number;
  attachmentsRestored: number;
  /** Non-null only when input.status === 'failed'. Sticky write. */
  failureMessage: string | null;
}

export interface ProcessRestoreCompleteDeps {
  /** 404 gate. Returns null if the row doesn't exist. */
  fetchRestoreById: (restoreId: string) => Promise<{ id: string } | null>;
  /**
   * Atomic per-base completion. Returns null if triggerRunId wasn't in
   * trigger_run_ids (idempotent replay). Otherwise returns the row's
   * post-update remainingCount + hasFailure flag.
   */
  applyPerBaseCompletion: (
    input: ApplyPerBaseRestoreCompletionInput,
  ) => Promise<{ remainingCount: number; hasFailure: boolean } | null>;
  /** Sets status + completed_at. Called only when remainingCount === 0. */
  finalizeRestore: (input: {
    restoreId: string;
    finalStatus: FinalRestoreStatus;
    completedAt: Date;
  }) => Promise<void>;
  /** Test seam — defaults to () => new Date() in production. */
  now?: () => Date;
}

export type ProcessRestoreCompleteResult =
  | { ok: true; kind: "noop" }
  | { ok: true; kind: "partial"; remainingCount: number }
  | { ok: true; kind: "finalized"; finalStatus: FinalRestoreStatus }
  | { ok: false; error: "restore_not_found" };

export async function processRestoreComplete(
  input: ProcessRestoreCompleteInput,
  deps: ProcessRestoreCompleteDeps,
): Promise<ProcessRestoreCompleteResult> {
  const now = deps.now ?? (() => new Date());

  // 1. Restore row must exist. The route handler returns 404 for this case.
  const restore = await deps.fetchRestoreById(input.restoreId);
  if (!restore) return { ok: false, error: "restore_not_found" };

  // 2. Apply atomic per-base completion. failureMessage is only sent on
  //    'failed' so the SQL CASE-WHEN can keep the FIRST failure's message.
  const failureMessage =
    input.status === "failed"
      ? (input.errorMessage ?? "unknown_failure")
      : null;
  const applied = await deps.applyPerBaseCompletion({
    restoreId: input.restoreId,
    triggerRunId: input.triggerRunId,
    tablesRestored: input.tablesRestored,
    recordsRestored: input.recordsRestored,
    attachmentsRestored: input.attachmentsRestored,
    failureMessage,
  });

  // 3. Replay — triggerRunId already removed from the array by an earlier
  //    callback. Return 200-shape so the runner doesn't keep retrying.
  if (applied === null) return { ok: true, kind: "noop" };

  // 4. Other bases are still outstanding; don't finalize yet.
  if (applied.remainingCount > 0) {
    return { ok: true, kind: "partial", remainingCount: applied.remainingCount };
  }

  // 5. Last callback. Compute final status (failure beats success).
  const finalStatus: FinalRestoreStatus = applied.hasFailure
    ? "failed"
    : "succeeded";

  await deps.finalizeRestore({
    restoreId: input.restoreId,
    finalStatus,
    completedAt: now(),
  });

  return { ok: true, kind: "finalized", finalStatus };
}
