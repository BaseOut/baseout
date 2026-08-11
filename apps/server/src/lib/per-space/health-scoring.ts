// Pure logic for AI Health scoring (openspec/changes/server-schema-health-scoring).
//
// The scoring task + engine routes broker DB and Claude I/O; the math lives here
// so prompt resolution, grade banding, and staleness are unit-testable without
// either. No DB / AI / DOM imports.

export type PromptSource = "override" | "space" | "system";
export type HealthBand = "green" | "yellow" | "red";

function present(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Resolve a metric's effective prompt: per-entity override → space-level →
 * system default. Blank/whitespace values are treated as absent.
 */
export function resolveMetricPrompt(input: {
  override?: string | null;
  space?: string | null;
  systemDefault: string;
}): { prompt: string; source: PromptSource } {
  if (present(input.override)) return { prompt: input.override, source: "override" };
  if (present(input.space)) return { prompt: input.space, source: "space" };
  return { prompt: input.systemDefault, source: "system" };
}

/** Band a 0–100 score: ≥90 green, 60–89 yellow, <60 red. Clamps out-of-range. */
export function band(score: number): HealthBand {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 90) return "green";
  if (s >= 60) return "yellow";
  return "red";
}

export interface MetricScore {
  /** 0–100 sub-score. */
  score: number;
  /** Contribution weight to the base grade. */
  weight: number;
  /** Whether the metric counts for this base. */
  enabled: boolean;
}

/**
 * The base grade — the weighted average of enabled metrics' sub-scores, banded.
 * Falls back to a simple average when all enabled weights are zero. Returns null
 * when no metric is enabled (no grade to show yet).
 */
export function aggregateGrade(
  metrics: MetricScore[],
): { score: number; band: HealthBand } | null {
  const enabled = metrics.filter((m) => m.enabled);
  if (enabled.length === 0) return null;

  const totalWeight = enabled.reduce((sum, m) => sum + m.weight, 0);
  const raw =
    totalWeight > 0
      ? enabled.reduce((sum, m) => sum + m.score * m.weight, 0) / totalWeight
      : enabled.reduce((sum, m) => sum + m.score, 0) / enabled.length;

  const score = Math.round(raw);
  return { score, band: band(score) };
}

/**
 * A metric is stale (its displayed sub-score no longer reflects the effective
 * prompt) when it has never been generated, or when the effective prompt was
 * updated after the run that last generated its score.
 */
export function isMetricStale(
  promptUpdatedAt: Date | null,
  lastGeneratedAt: Date | null,
): boolean {
  if (lastGeneratedAt == null) return true;
  if (promptUpdatedAt == null) return false;
  return promptUpdatedAt.getTime() > lastGeneratedAt.getTime();
}
