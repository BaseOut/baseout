// Resolve the inputs the Health scoring task needs for one base
// (server-schema-health-scoring §4.2c — the enqueue path).
//
// The scoring task (workflows health-score-base) is given the ENABLED metrics
// with their effective prompts + a metadata-only schema context. This resolves
// all of that: the org catalog (master health_score_rules) intersected with the
// per-Space enable state, each metric's effective prompt (base override → space
// → system default), and the base's schema slice.

import { eq } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { Sql } from "postgres";
import type { AppDb } from "../../db/worker";
import { spaces, healthScoreRules } from "../../db/schema";
import { withSpaceSchema } from "./space-db-pg";
import {
  readEntityOverrides,
  readMetricState,
  readSpacePrompts,
} from "./health-config-io";
import { resolveMetricPrompt } from "./health-scoring";
import { assembleChatContext } from "./chat-context";

export interface ResolvedScoreMetric {
  ruleId: string;
  prompt: string;
  entityTier: string;
}

export interface ResolvedScoreInputs {
  metrics: ResolvedScoreMetric[];
  schemaContext: string;
}

/**
 * Resolve enabled metrics (with effective prompts) + the base's schema context.
 * Returns metrics=[] when the org has no prompted/enabled rules (nothing to
 * score). Reads the master catalog + the per-Space config/schema.
 */
export async function resolveScoreInputs(
  masterDb: AppDb,
  pgLocator: string,
  args: { spaceId: string; baseId: string },
): Promise<ResolvedScoreInputs> {
  const [spaceRow] = await masterDb
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, args.spaceId))
    .limit(1);
  if (!spaceRow) return { metrics: [], schemaContext: "" };

  const catalog = await masterDb
    .select({
      id: healthScoreRules.id,
      enabled: healthScoreRules.enabled,
      prompt: healthScoreRules.prompt,
      entityTier: healthScoreRules.entityTier,
    })
    .from(healthScoreRules)
    .where(eq(healthScoreRules.organizationId, spaceRow.organizationId));

  return withSpaceSchema(masterDb, pgLocator, async (tx) => {
    const [state, spacePrompts, baseOverrides, bases, tables, fields] = await Promise.all([
      readMetricState(tx, args.baseId),
      readSpacePrompts(tx),
      readEntityOverrides(tx, { targetType: "base", targetId: args.baseId }),
      tx
        .select({ baseId: spacePg.bases.baseId, name: spacePg.bases.name, description: spacePg.bases.description })
        .from(spacePg.bases),
      tx
        .select({
          tableId: spacePg.tables.tableId,
          baseId: spacePg.tables.baseId,
          name: spacePg.tables.name,
          description: spacePg.tables.description,
        })
        .from(spacePg.tables),
      tx
        .select({
          fieldId: spacePg.fields.fieldId,
          tableId: spacePg.fields.tableId,
          baseId: spacePg.fields.baseId,
          name: spacePg.fields.name,
          type: spacePg.fields.type,
          description: spacePg.fields.description,
        })
        .from(spacePg.fields),
    ]);

    const metrics: ResolvedScoreMetric[] = [];
    for (const rule of catalog) {
      // Catalog must be enabled + have a system prompt; per-base may disable.
      if (!rule.enabled || !rule.prompt) continue;
      if (state.get(rule.id) === false) continue;
      const { prompt } = resolveMetricPrompt({
        override: baseOverrides.get(rule.id) ?? null,
        space: spacePrompts.get(rule.id) ?? null,
        systemDefault: rule.prompt,
      });
      metrics.push({ ruleId: rule.id, prompt, entityTier: rule.entityTier ?? "base" });
    }

    const schemaContext = assembleChatContext({
      scope: { baseIds: [args.baseId] },
      bases,
      tables,
      fields,
    });

    return { metrics, schemaContext };
  });
}
