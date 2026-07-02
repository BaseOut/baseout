// Per-Space Health config I/O (server-schema-health-scoring §4.2c).
//
// Runs inside `withSpaceSchema(...)`. Holds the per-Space prompt overrides
// (space-level + per-entity), the per-base enable/disable state, and the reads
// the scoring enqueue uses to resolve effective prompts. Mirrors chat-io/health-io.

import { and, eq } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";

/** ruleId → space-level prompt override. */
export async function readSpacePrompts(tx: SpaceTx): Promise<Map<string, string>> {
  const rows = await tx
    .select({ ruleId: spacePg.healthMetricPrompts.ruleId, prompt: spacePg.healthMetricPrompts.prompt })
    .from(spacePg.healthMetricPrompts);
  return new Map(rows.map((r) => [r.ruleId, r.prompt]));
}

/** ruleId → per-entity prompt override for one (targetType,targetId). */
export async function readEntityOverrides(
  tx: SpaceTx,
  target: { targetType: string; targetId: string },
): Promise<Map<string, string>> {
  const rows = await tx
    .select({ ruleId: spacePg.healthMetricOverrides.ruleId, prompt: spacePg.healthMetricOverrides.prompt })
    .from(spacePg.healthMetricOverrides)
    .where(
      and(
        eq(spacePg.healthMetricOverrides.targetType, target.targetType),
        eq(spacePg.healthMetricOverrides.targetId, target.targetId),
      ),
    );
  return new Map(rows.map((r) => [r.ruleId, r.prompt]));
}

/** ruleId → enabled, for a base (absent ⇒ default enabled). */
export async function readMetricState(tx: SpaceTx, baseId: string): Promise<Map<string, boolean>> {
  const rows = await tx
    .select({ ruleId: spacePg.healthMetricState.ruleId, enabled: spacePg.healthMetricState.enabled })
    .from(spacePg.healthMetricState)
    .where(eq(spacePg.healthMetricState.baseId, baseId));
  return new Map(rows.map((r) => [r.ruleId, r.enabled]));
}

/** Upsert (or, when prompt is null, clear) the space-level prompt for a rule. */
export async function setSpacePrompt(
  tx: SpaceTx,
  args: { ruleId: string; prompt: string | null },
): Promise<void> {
  if (args.prompt === null) {
    await tx.delete(spacePg.healthMetricPrompts).where(eq(spacePg.healthMetricPrompts.ruleId, args.ruleId));
    return;
  }
  const existing = await tx
    .select({ id: spacePg.healthMetricPrompts.id })
    .from(spacePg.healthMetricPrompts)
    .where(eq(spacePg.healthMetricPrompts.ruleId, args.ruleId))
    .limit(1);
  if (existing[0]) {
    await tx
      .update(spacePg.healthMetricPrompts)
      .set({ prompt: args.prompt, updatedAt: new Date() })
      .where(eq(spacePg.healthMetricPrompts.id, existing[0].id));
  } else {
    await tx
      .insert(spacePg.healthMetricPrompts)
      .values({ ruleId: args.ruleId, prompt: args.prompt, updatedAt: new Date() });
  }
}

/** Upsert (or clear) a per-entity prompt override. */
export async function setEntityOverride(
  tx: SpaceTx,
  args: { ruleId: string; targetType: string; targetId: string; prompt: string | null },
): Promise<void> {
  const where = and(
    eq(spacePg.healthMetricOverrides.ruleId, args.ruleId),
    eq(spacePg.healthMetricOverrides.targetType, args.targetType),
    eq(spacePg.healthMetricOverrides.targetId, args.targetId),
  );
  if (args.prompt === null) {
    await tx.delete(spacePg.healthMetricOverrides).where(where);
    return;
  }
  const existing = await tx
    .select({ id: spacePg.healthMetricOverrides.id })
    .from(spacePg.healthMetricOverrides)
    .where(where)
    .limit(1);
  if (existing[0]) {
    await tx
      .update(spacePg.healthMetricOverrides)
      .set({ prompt: args.prompt, updatedAt: new Date() })
      .where(eq(spacePg.healthMetricOverrides.id, existing[0].id));
  } else {
    await tx.insert(spacePg.healthMetricOverrides).values({
      ruleId: args.ruleId,
      targetType: args.targetType,
      targetId: args.targetId,
      prompt: args.prompt,
      updatedAt: new Date(),
    });
  }
}

export interface HealthConfigRows {
  state: Map<string, boolean>;
  /** ruleId → space-level prompt override + when it changed. */
  spacePrompts: Map<string, { prompt: string; updatedAt: Date | null }>;
  /** ruleId → base-level prompt override + when it changed. */
  baseOverrides: Map<string, { prompt: string; updatedAt: Date | null }>;
  /** ruleId → last score time (for staleness). */
  lastGeneratedAt: Map<string, Date | null>;
}

/** Read everything the Health editor needs for a base in one pass. */
export async function readHealthConfigRows(tx: SpaceTx, baseId: string): Promise<HealthConfigRows> {
  const [stateRows, promptRows, overrideRows, scoreRows] = await Promise.all([
    tx
      .select({ ruleId: spacePg.healthMetricState.ruleId, enabled: spacePg.healthMetricState.enabled })
      .from(spacePg.healthMetricState)
      .where(eq(spacePg.healthMetricState.baseId, baseId)),
    tx
      .select({
        ruleId: spacePg.healthMetricPrompts.ruleId,
        prompt: spacePg.healthMetricPrompts.prompt,
        updatedAt: spacePg.healthMetricPrompts.updatedAt,
      })
      .from(spacePg.healthMetricPrompts),
    tx
      .select({
        ruleId: spacePg.healthMetricOverrides.ruleId,
        prompt: spacePg.healthMetricOverrides.prompt,
        updatedAt: spacePg.healthMetricOverrides.updatedAt,
      })
      .from(spacePg.healthMetricOverrides)
      .where(
        and(
          eq(spacePg.healthMetricOverrides.targetType, "base"),
          eq(spacePg.healthMetricOverrides.targetId, baseId),
        ),
      ),
    tx
      .select({
        ruleId: spacePg.healthMetricScores.ruleId,
        lastGeneratedAt: spacePg.healthMetricScores.lastGeneratedAt,
      })
      .from(spacePg.healthMetricScores)
      .where(eq(spacePg.healthMetricScores.baseId, baseId)),
  ]);

  return {
    state: new Map(stateRows.map((r) => [r.ruleId, r.enabled])),
    spacePrompts: new Map(promptRows.map((r) => [r.ruleId, { prompt: r.prompt, updatedAt: r.updatedAt }])),
    baseOverrides: new Map(overrideRows.map((r) => [r.ruleId, { prompt: r.prompt, updatedAt: r.updatedAt }])),
    lastGeneratedAt: new Map(scoreRows.map((r) => [r.ruleId, r.lastGeneratedAt])),
  };
}

/** Upsert the per-base enable/disable state for a rule. */
export async function setMetricEnabled(
  tx: SpaceTx,
  args: { baseId: string; ruleId: string; enabled: boolean },
): Promise<void> {
  const existing = await tx
    .select({ id: spacePg.healthMetricState.id })
    .from(spacePg.healthMetricState)
    .where(
      and(
        eq(spacePg.healthMetricState.baseId, args.baseId),
        eq(spacePg.healthMetricState.ruleId, args.ruleId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await tx
      .update(spacePg.healthMetricState)
      .set({ enabled: args.enabled })
      .where(eq(spacePg.healthMetricState.id, existing[0].id));
  } else {
    await tx
      .insert(spacePg.healthMetricState)
      .values({ baseId: args.baseId, ruleId: args.ruleId, enabled: args.enabled });
  }
}
