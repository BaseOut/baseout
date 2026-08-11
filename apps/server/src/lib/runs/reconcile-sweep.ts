// Reconciliation sweep — pure orchestration over decideReconciliation
// (server-run-reconciliation). Deps injected; production wiring in
// reconcile-deps.ts, fired from the */15 cron dispatch. Covers backup AND
// restore runs (mirrored lifecycles) with the same decision function.
//
// Per-run isolation: a Trigger.dev lookup failure or DB error on one run
// counts it `skipped`/`failed` and never aborts the sweep. The guarded
// UPDATE (status IN ('queued','running')) in the deps is what makes a race
// with a late /complete safe — exactly one terminal transition wins.

import {
  decideReconciliation,
  type ReconcileDecision,
  type ReconcileRun,
} from "./reconcile";

export type ReconcileKind = "backup" | "restore";

export interface ReconcileSweepDeps {
  /** Non-terminal runs older than the SELECT prefilter, oldest first. */
  listStuckRuns: (kind: ReconcileKind, limit: number) => Promise<ReconcileRun[]>;
  /** Trigger.dev statuses aligned to ids; null entries = lookup failed. */
  lookupTaskStatuses: (ids: string[]) => Promise<(string | null)[]>;
  /** Guarded terminal transition; returns false when the guard lost the race. */
  applyDecision: (
    kind: ReconcileKind,
    runId: string,
    decision: Exclude<ReconcileDecision, { action: "leave" }>,
  ) => Promise<boolean>;
  log: (event: Record<string, unknown>) => void;
  now?: () => Date;
  maxPerSweep?: number;
}

export interface ReconcileSweepResult {
  scanned: number;
  reconciled: number;
  leftAlone: number;
  raceLost: number;
  errors: number;
  truncated: boolean;
}

const DEFAULT_MAX_PER_SWEEP = 25;

export async function runReconcileSweep(
  deps: ReconcileSweepDeps,
): Promise<ReconcileSweepResult> {
  const now = deps.now?.() ?? new Date();
  const max = deps.maxPerSweep ?? DEFAULT_MAX_PER_SWEEP;

  let scanned = 0;
  let reconciled = 0;
  let leftAlone = 0;
  let raceLost = 0;
  let errors = 0;
  let truncated = false;

  for (const kind of ["backup", "restore"] as const) {
    const rows = await deps.listStuckRuns(kind, max + 1);
    const batch = rows.length > max ? rows.slice(0, max) : rows;
    truncated = truncated || rows.length > max;
    scanned += batch.length;

    for (const run of batch) {
      try {
        const statuses =
          run.triggerRunIds && run.triggerRunIds.length > 0
            ? await deps.lookupTaskStatuses(run.triggerRunIds)
            : [];
        const decision = decideReconciliation(run, statuses, now);
        if (decision.action === "leave") {
          leftAlone += 1;
          continue;
        }
        const won = await deps.applyDecision(kind, run.id, decision);
        if (won) reconciled += 1;
        else raceLost += 1;
      } catch {
        errors += 1;
      }
    }
  }

  const result: ReconcileSweepResult = {
    scanned,
    reconciled,
    leftAlone,
    raceLost,
    errors,
    truncated,
  };
  deps.log({ event: "run_reconcile_sweep", ...result });
  return result;
}
