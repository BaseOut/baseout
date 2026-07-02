// Per-Space Health result I/O (openspec/changes/server-schema-health-scoring).
//
// Runs inside `withSpaceSchema(...)` so the unqualified bo_at_* tables resolve
// into the Space's schema. The workflows `health-score-base` task POSTs per-metric
// sub-scores + findings to the health-sync route; this writes them to the
// per-Space result tables. The base-grade aggregation (catalog-weighted) +
// reads/overview are a follow-up that needs the master catalog — kept out of the
// write path here.

import { and, eq } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import { aggregateGrade } from "./health-scoring";

export interface HealthSyncFinding {
  severity: string; // 'high' | 'medium' | 'low'
  targetType?: string | null; // base | table | field
  targetId?: string | null;
  message: string;
  airtableDeeplink?: string | null;
}

export interface HealthSyncMetric {
  ruleId: string;
  score: number; // already clamped 0–100 by the task
  findings: HealthSyncFinding[];
}

/**
 * Persist a base's metric scores + findings. Each metric's current sub-score is
 * replaced (one row per base+rule, carrying last_generated_at for staleness),
 * and the base's issue list is replaced with the latest run's findings.
 */
export async function writeHealthResults(
  tx: SpaceTx,
  args: {
    baseId: string;
    runId: string;
    metrics: HealthSyncMetric[];
    /** Catalog weight per ruleId (master health_score_rules) for grade aggregation. */
    weightByRuleId: Record<string, number>;
  },
): Promise<{ metricsWritten: number; issuesWritten: number; grade: number | null }> {
  const now = new Date();

  for (const m of args.metrics) {
    await tx
      .delete(spacePg.healthMetricScores)
      .where(
        and(
          eq(spacePg.healthMetricScores.baseId, args.baseId),
          eq(spacePg.healthMetricScores.ruleId, m.ruleId),
        ),
      );
    await tx.insert(spacePg.healthMetricScores).values({
      baseId: args.baseId,
      ruleId: m.ruleId,
      runId: args.runId,
      score: m.score,
      lastGeneratedAt: now,
    });
  }

  // Replace the base's issue list with the latest run's findings.
  await tx.delete(spacePg.healthIssues).where(eq(spacePg.healthIssues.baseId, args.baseId));
  const issueRows = args.metrics.flatMap((m) =>
    m.findings.map((f) => ({
      baseId: args.baseId,
      tableId: f.targetType === "table" ? f.targetId ?? null : null,
      fieldId: f.targetType === "field" ? f.targetId ?? null : null,
      runId: args.runId,
      ruleId: m.ruleId,
      severity: f.severity,
      category: null,
      message: f.message,
      occurrenceCount: null,
      airtableDeeplink: f.airtableDeeplink ?? null,
    })),
  );
  if (issueRows.length > 0) {
    await tx.insert(spacePg.healthIssues).values(issueRows);
  }

  // Base grade — weighted aggregate of the synced (enabled) metrics. The task
  // only scores enabled metrics, so the synced set is the enabled set. Replace
  // the base's current grade (per-run trend history needs a created_at column on
  // bo_at_health_scores — follow-up).
  const grade = aggregateGrade(
    args.metrics.map((m) => ({
      score: m.score,
      weight: args.weightByRuleId[m.ruleId] ?? 0,
      enabled: true,
    })),
  );
  await tx.delete(spacePg.healthScores).where(eq(spacePg.healthScores.baseId, args.baseId));
  if (grade) {
    await tx.insert(spacePg.healthScores).values({
      baseId: args.baseId,
      runId: args.runId,
      score: grade.score,
      band: grade.band,
      categories: null,
    });
  }

  return {
    metricsWritten: args.metrics.length,
    issuesWritten: issueRows.length,
    grade: grade?.score ?? null,
  };
}

export interface HealthOverviewMetric {
  ruleId: string;
  score: number;
  lastGeneratedAt: string | null;
}
export interface HealthOverviewIssue {
  ruleId: string;
  severity: string;
  tableId: string | null;
  fieldId: string | null;
  message: string;
  airtableDeeplink: string | null;
}
export interface HealthOverview {
  grade: { score: number; band: string } | null;
  metrics: HealthOverviewMetric[];
  issues: HealthOverviewIssue[];
}

/**
 * Read a base's current Health results: the latest grade, per-metric sub-scores
 * (with last_generated_at for staleness), and the issue list. The route enriches
 * the per-metric rows with catalog labels (name/weight/tier) from the master DB.
 */
export async function readHealthOverview(tx: SpaceTx, baseId: string): Promise<HealthOverview> {
  const gradeRows = await tx
    .select({ score: spacePg.healthScores.score, band: spacePg.healthScores.band })
    .from(spacePg.healthScores)
    .where(eq(spacePg.healthScores.baseId, baseId))
    .limit(1);

  const metricRows = await tx
    .select({
      ruleId: spacePg.healthMetricScores.ruleId,
      score: spacePg.healthMetricScores.score,
      lastGeneratedAt: spacePg.healthMetricScores.lastGeneratedAt,
    })
    .from(spacePg.healthMetricScores)
    .where(eq(spacePg.healthMetricScores.baseId, baseId));

  const issueRows = await tx
    .select({
      ruleId: spacePg.healthIssues.ruleId,
      severity: spacePg.healthIssues.severity,
      tableId: spacePg.healthIssues.tableId,
      fieldId: spacePg.healthIssues.fieldId,
      message: spacePg.healthIssues.message,
      airtableDeeplink: spacePg.healthIssues.airtableDeeplink,
    })
    .from(spacePg.healthIssues)
    .where(eq(spacePg.healthIssues.baseId, baseId));

  return {
    grade: gradeRows[0] ? { score: gradeRows[0].score, band: gradeRows[0].band } : null,
    metrics: metricRows.map((r) => ({
      ruleId: r.ruleId,
      score: r.score,
      lastGeneratedAt: r.lastGeneratedAt ? r.lastGeneratedAt.toISOString() : null,
    })),
    issues: issueRows.map((r) => ({
      ruleId: r.ruleId,
      severity: r.severity,
      tableId: r.tableId,
      fieldId: r.fieldId,
      message: r.message,
      airtableDeeplink: r.airtableDeeplink,
    })),
  };
}

