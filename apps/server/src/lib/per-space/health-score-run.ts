// Engine-side Health scoring on Workers AI (all-Cloudflare POC decision,
// 2026-07-10). Replaces the Claude-via-Trigger.dev generation path: the
// per-metric loop is ported from apps/workflows/trigger/tasks/
// health-score-base.ts (which remains in place for a future premium-model
// path), and the model call rides the same `env.AI` binding as
// describe-schema — zero API keys.

import { eq } from "drizzle-orm";
import { healthScoreRules, spaces } from "../../db/schema";
import type { AppDb } from "../../db/worker";
import type { Env } from "../../env";
import { parseModelJson } from "./describe-schema";
import { resolveScoreInputs } from "./health-resolve";
import { writeHealthResults, type HealthSyncMetric } from "./health-io";
import { withSpaceSchema } from "./space-db-pg";

export interface HealthFinding {
  severity: string;
  targetType?: string | null;
  targetId?: string | null;
  message: string;
  airtableDeeplink?: string | null;
}

export interface ScoreMetricFn {
  (args: { prompt: string; entityTier: string; schemaContext: string }): Promise<{
    score: number;
    findings: HealthFinding[];
  }>;
}

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const SEVERITIES = new Set(["high", "medium", "low"]);
const TARGET_TYPES = new Set(["base", "table", "field"]);

/**
 * Validate/sanitize a parsed model response into a score + findings.
 * Pure — unit-tested without the binding. Throws on unusable output so the
 * per-metric loop counts it as a failed metric.
 */
export function parseScoreResponse(parsed: unknown): { score: number; findings: HealthFinding[] } {
  if (parsed == null || typeof parsed !== "object") throw new Error("unparseable score response");
  const p = parsed as { score?: unknown; findings?: unknown };
  if (typeof p.score !== "number" || Number.isNaN(p.score)) throw new Error("missing score");
  const findings: HealthFinding[] = [];
  if (Array.isArray(p.findings)) {
    for (const f of p.findings as unknown[]) {
      if (f == null || typeof f !== "object") continue;
      const x = f as { severity?: unknown; targetType?: unknown; targetId?: unknown; message?: unknown };
      if (typeof x.message !== "string" || !x.message.trim()) continue;
      findings.push({
        severity: typeof x.severity === "string" && SEVERITIES.has(x.severity) ? x.severity : "low",
        targetType: typeof x.targetType === "string" && TARGET_TYPES.has(x.targetType) ? x.targetType : null,
        targetId: typeof x.targetId === "string" ? x.targetId : null,
        message: x.message.trim().slice(0, 500),
      });
    }
  }
  return { score: clampScore(p.score), findings };
}

export function buildMetricPrompt(args: { prompt: string; schemaContext: string }): string {
  return [
    `You audit Airtable schemas. Metric: ${args.prompt}`,
    ``,
    `Schema (metadata only — names, types, descriptions; no record data):`,
    args.schemaContext,
    ``,
    `Score this base 0-100 for the metric (100 = perfect) and list concrete findings.`,
    `Respond with ONLY a JSON object, no prose, shaped exactly like:`,
    `{"score": 0, "findings": [{"severity": "high|medium|low", "targetType": "base|table|field", "targetId": "…", "message": "…"}]}`,
  ].join("\n");
}

/** Same POC default + override knob family as describe-schema. */
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** ScoreMetricFn over the Workers AI binding, or null when absent/disabled. */
export function workersAiScoreMetric(env: Env): ScoreMetricFn | null {
  const ai = env.AI;
  if (!ai || env.AI_DESCRIPTIONS_ENABLED === "false") return null;
  const model = env.AI_DESCRIPTIONS_MODEL || DEFAULT_MODEL;
  return async ({ prompt, schemaContext }) => {
    const res = (await ai.run(model as Parameters<Ai["run"]>[0], {
      messages: [{ role: "user", content: buildMetricPrompt({ prompt, schemaContext }) }],
      max_tokens: 1200,
    })) as { response?: unknown };
    const r = res?.response;
    return parseScoreResponse(parseModelJson(typeof r === "string" ? r : ((r ?? "") as never)));
  };
}

/**
 * Score every enabled metric for a base and persist the results — ported loop
 * (workflows health-score-base): a per-metric error skips that metric, never
 * the run; nothing is written when no metric scored.
 */
export async function runEngineHealthScore(args: {
  masterDb: AppDb;
  pgLocator: string;
  spaceId: string;
  baseId: string;
  runId: string;
  scoreMetric: ScoreMetricFn;
}): Promise<{ metricsScored: number; metricsFailed: number }> {
  const { metrics, schemaContext } = await resolveScoreInputs(args.masterDb, args.pgLocator, {
    spaceId: args.spaceId,
    baseId: args.baseId,
  });
  if (metrics.length === 0) return { metricsScored: 0, metricsFailed: 0 };

  const results: HealthSyncMetric[] = [];
  let metricsFailed = 0;
  for (const metric of metrics) {
    try {
      const { score, findings } = await args.scoreMetric({
        prompt: metric.prompt,
        entityTier: metric.entityTier,
        schemaContext,
      });
      results.push({ ruleId: metric.ruleId, score, findings });
    } catch (err) {
      metricsFailed += 1;
      // eslint-disable-next-line no-console -- background-metric failure would otherwise be invisible
      console.error("health-score metric failed:", err instanceof Error ? err.message : String(err));
    }
  }
  if (results.length === 0) return { metricsScored: 0, metricsFailed };

  // Catalog weights for the base-grade aggregation (same query health-sync uses).
  const [spaceRow] = await args.masterDb
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, args.spaceId))
    .limit(1);
  const weightByRuleId: Record<string, number> = {};
  if (spaceRow) {
    const rules = await args.masterDb
      .select({ id: healthScoreRules.id, weight: healthScoreRules.weight })
      .from(healthScoreRules)
      .where(eq(healthScoreRules.organizationId, spaceRow.organizationId));
    for (const r of rules) weightByRuleId[r.id] = r.weight;
  }

  await withSpaceSchema(args.masterDb, args.pgLocator, (tx) =>
    writeHealthResults(tx, { baseId: args.baseId, runId: args.runId, metrics: results, weightByRuleId }),
  );
  return { metricsScored: results.length, metricsFailed };
}
