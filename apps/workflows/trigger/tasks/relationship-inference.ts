// Pure orchestration for relationship inference (workflows-relationship-inference).
//
// After a backup captures schema, this triggers the engine to (re)infer
// synced-view candidates for each base in the run. The heuristic itself runs
// engine-side (data locality — the engine holds the per-Space schema); this task
// just drives it per base with per-base error isolation, mirroring the
// health-score-base pure/wrapper split. The thin wrapper (.task.ts) injects the
// engine HTTP POST.

export interface RelationshipInferenceInput {
  spaceId: string;
  runId: string;
  /** Bases captured in this run; inference runs once per base. */
  baseIds: string[];
}

export interface PerBaseSyncResult {
  inserted: number;
  refreshed: number;
  skipped: number;
  proposed: number;
}

export interface RelationshipInferenceDeps {
  /** POST the engine /relationships/sync for one base; engine runs the heuristic. */
  syncBase: (baseId: string) => Promise<PerBaseSyncResult>;
}

export interface RelationshipInferenceResult {
  basesProcessed: number;
  totals: PerBaseSyncResult;
  errors: { baseId: string; message: string }[];
}

export async function runRelationshipInference(
  input: RelationshipInferenceInput,
  deps: RelationshipInferenceDeps,
): Promise<RelationshipInferenceResult> {
  const totals: PerBaseSyncResult = { inserted: 0, refreshed: 0, skipped: 0, proposed: 0 };
  const errors: { baseId: string; message: string }[] = [];
  let basesProcessed = 0;

  for (const baseId of input.baseIds) {
    try {
      const r = await deps.syncBase(baseId);
      totals.inserted += r.inserted;
      totals.refreshed += r.refreshed;
      totals.skipped += r.skipped;
      totals.proposed += r.proposed;
      basesProcessed++;
    } catch (err) {
      // Per-base isolation: one base's failure doesn't sink the rest.
      errors.push({ baseId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { basesProcessed, totals, errors };
}
