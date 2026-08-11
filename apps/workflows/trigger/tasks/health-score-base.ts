// Pure orchestration for the Health scoring task
// (openspec/changes/workflows-health-scoring). The Claude call (`scoreMetric`)
// and the engine `health-sync` POST (`postHealthSync`) are injected deps so the
// per-metric loop is unit-testable without the SDK or the engine. The thin
// wrapper (health-score-base.task.ts) supplies the real implementations.

export interface HealthFinding {
  severity: string; // 'high' | 'medium' | 'low'
  targetType?: string | null; // base | table | field
  targetId?: string | null;
  message: string;
  airtableDeeplink?: string | null;
}

export interface HealthMetricInput {
  ruleId: string;
  /** The resolved effective prompt (override → space → system default). */
  prompt: string;
  entityTier: string; // base | table | field
}

export interface HealthScoreBaseInput {
  spaceId: string;
  baseId: string;
  runId: string;
  /** Enabled metrics for this base, with their resolved effective prompts. */
  metrics: HealthMetricInput[];
  /** Schema-metadata-only context (entity names/types/descriptions — no records). */
  schemaContext: string;
}

export interface MetricResult {
  ruleId: string;
  score: number; // clamped 0–100
  findings: HealthFinding[];
}

export interface HealthSyncPayload {
  baseId: string;
  runId: string;
  metrics: MetricResult[];
}

export interface HealthScoreBaseDeps {
  scoreMetric: (args: {
    prompt: string;
    entityTier: string;
    schemaContext: string;
  }) => Promise<{ score: number; findings: HealthFinding[] }>;
  postHealthSync: (payload: HealthSyncPayload) => Promise<void>;
}

export interface HealthScoreBaseResult {
  metricsScored: number;
  metricsFailed: number;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Score every enabled metric for a base and POST the results to the engine.
 * A per-metric scorer error skips that metric (counted in `metricsFailed`)
 * rather than failing the whole run, so one bad metric doesn't lose the rest.
 * Nothing is synced when no metric scored.
 */
export async function runHealthScoreBase(
  input: HealthScoreBaseInput,
  deps: HealthScoreBaseDeps,
): Promise<HealthScoreBaseResult> {
  const results: MetricResult[] = [];
  let metricsFailed = 0;

  for (const metric of input.metrics) {
    try {
      const { score, findings } = await deps.scoreMetric({
        prompt: metric.prompt,
        entityTier: metric.entityTier,
        schemaContext: input.schemaContext,
      });
      results.push({ ruleId: metric.ruleId, score: clampScore(score), findings });
    } catch {
      metricsFailed += 1;
    }
  }

  if (results.length > 0) {
    await deps.postHealthSync({
      baseId: input.baseId,
      runId: input.runId,
      metrics: results,
    });
  }

  return { metricsScored: results.length, metricsFailed };
}
