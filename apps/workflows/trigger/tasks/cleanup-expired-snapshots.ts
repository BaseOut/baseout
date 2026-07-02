// Pure-function orchestration for the cleanup-expired-snapshots cron task
// (openspec/changes/workflows-retention-and-cleanup).
//
// This is the WORKFLOWS half of the retention cleanup pass. The engine
// (server-retention-and-cleanup) decides WHAT to prune and returns a plan via
// POST /api/internal/cleanup-plan; this module performs the actual
// StorageWriter.deletePrefix in the Trigger.dev Node runtime — Cloudflare
// Workers cannot reach R2/BYOS storage, only this runner can (CLAUDE.md §6) —
// then reports per-run ok/fail back via POST /api/internal/cleanup-complete so
// the engine soft-deletes the confirmed rows (sets deleted_at).
//
// Pure + dep-injected (fetchPlan / resolveWriter / postComplete) so it tests in
// plain Node without R2 creds; the task wrapper supplies the real HTTP +
// StorageWriter factory.
//
// Per-prefix failures don't abort the pass — a run with any failed prefix is
// reported ok:false so its deleted_at stays NULL and the next hourly pass
// retries it (idempotent; deletePrefix is itself idempotent).

import type { StorageWriter } from "./_lib/storage-writer";

/** One run to prune, as returned by the engine's cleanup-plan endpoint. */
export interface CleanupRunPlanItem {
  runId: string;
  spaceId: string;
  storageType: string;
  prefixes: string[];
}

export interface CleanupPlan {
  runs: CleanupRunPlanItem[];
}

export interface CleanupCompletion {
  runId: string;
  ok: boolean;
}

export interface RunCleanupSweepDeps {
  /** GET the delete plan from the engine. */
  fetchPlan: () => Promise<CleanupPlan>;
  /** Resolve a StorageWriter for a run's storage_type. */
  resolveWriter: (storageType: string) => StorageWriter;
  /** Report per-run outcomes so the engine soft-deletes the ok rows. */
  postComplete: (
    completed: CleanupCompletion[],
  ) => Promise<{ updated: number } | void>;
}

export interface RunCleanupSweepResult {
  /** Runs the engine planned to prune. */
  planned: number;
  /** Runs whose every prefix deleted cleanly (reported ok:true). */
  deleted: number;
  /** Runs with ≥1 failed prefix (reported ok:false; retried next pass). */
  failed: number;
}

export async function runCleanupSweep(
  deps: RunCleanupSweepDeps,
): Promise<RunCleanupSweepResult> {
  const plan = await deps.fetchPlan();
  const completed: CleanupCompletion[] = [];
  let deleted = 0;
  let failed = 0;

  for (const run of plan.runs) {
    const writer = deps.resolveWriter(run.storageType);
    let ok = true;
    for (const prefix of run.prefixes) {
      try {
        await writer.deletePrefix(prefix);
      } catch {
        // Continue past per-prefix failures so a single bad base doesn't strand
        // the rest of the run; the whole run is reported ok:false and retried.
        ok = false;
      }
    }
    if (ok) deleted += 1;
    else failed += 1;
    completed.push({ runId: run.runId, ok });
  }

  if (completed.length > 0) {
    await deps.postComplete(completed);
  }

  return { planned: plan.runs.length, deleted, failed };
}
