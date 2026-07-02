// Production wiring for buildCleanupPlan deps
// (openspec/changes/server-retention-and-cleanup Phase C.2).
//
// Mirrors buildRunDeleteDeps — extracted from the route handler so the
// orchestration (build-cleanup-plan.test.ts) can substitute vi.fn() deps
// without touching the masterDb. Reuses buildRunDeleteDeps.computeRunPrefixes
// (the per-base prefix join is identical to the user-initiated run delete) and
// the engine's resolveCapabilities for tier resolution.

import { and, eq, inArray, sql } from "drizzle-orm";
import { backupRetentionPolicies, backupRuns, spaces } from "../../db/schema";
import { resolveCapabilities } from "../capabilities/resolve";
import { buildRunDeleteDeps } from "../runs/delete-deps";
import type { BuildCleanupPlanDeps } from "./build-cleanup-plan";
import type { RetentionPolicyValues } from "./types";

type MasterDb = ReturnType<typeof import("../../db/worker").createMasterDb>["db"];

// Terminal statuses are the only prunable runs — never touch queued / running /
// cancelling / deleting rows. Matches the run-delete terminal set.
const TERMINAL_STATUSES = [
  "succeeded",
  "failed",
  "cancelled",
  "trial_complete",
  "trial_truncated",
] as const;

export function buildCleanupPlanDeps(db: MasterDb): BuildCleanupPlanDeps {
  const runDeleteDeps = buildRunDeleteDeps(db);

  return {
    listSpacesWithLiveRuns: async () => {
      const rows = await db
        .selectDistinct({ spaceId: backupRuns.spaceId })
        .from(backupRuns)
        .where(
          and(
            sql`${backupRuns.deletedAt} IS NULL`,
            inArray(backupRuns.status, [...TERMINAL_STATUSES]),
          ),
        );
      return rows.map((r) => r.spaceId);
    },

    resolveSpaceTier: async (spaceId) => {
      const [space] = await db
        .select({ organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, spaceId))
        .limit(1);
      if (!space) return null;
      const resolved = await resolveCapabilities(
        db,
        space.organizationId,
        "airtable",
      );
      return resolved.tier;
    },

    loadPolicy: async (spaceId) => {
      const [row] = await db
        .select({
          policyTier: backupRetentionPolicies.policyTier,
          keepLastN: backupRetentionPolicies.keepLastN,
          dailyWindowDays: backupRetentionPolicies.dailyWindowDays,
          weeklyWindowDays: backupRetentionPolicies.weeklyWindowDays,
          monthlyIndefinite: backupRetentionPolicies.monthlyIndefinite,
          customRules: backupRetentionPolicies.customRules,
        })
        .from(backupRetentionPolicies)
        .where(eq(backupRetentionPolicies.spaceId, spaceId))
        .limit(1);
      if (!row) return null;
      return {
        tier: row.policyTier,
        keepLastN: row.keepLastN,
        dailyWindowDays: row.dailyWindowDays,
        weeklyWindowDays: row.weeklyWindowDays,
        monthlyIndefinite: row.monthlyIndefinite,
        customRules: row.customRules,
      } satisfies RetentionPolicyValues;
    },

    loadRunsForSpace: async (spaceId) => {
      const rows = await db
        .select({
          id: backupRuns.id,
          startedAt: backupRuns.startedAt,
          isTrial: backupRuns.isTrial,
        })
        .from(backupRuns)
        .where(
          and(
            eq(backupRuns.spaceId, spaceId),
            sql`${backupRuns.deletedAt} IS NULL`,
            inArray(backupRuns.status, [...TERMINAL_STATUSES]),
          ),
        );
      return rows.map((r) => ({
        id: r.id,
        // Terminal runs always have started_at; fall back to epoch (treated as
        // maximally old → pruned first) for the defensive null case.
        startedAt: r.startedAt ?? new Date(0),
        isTrial: r.isTrial,
      }));
    },

    computeRunPrefixes: runDeleteDeps.computeRunPrefixes,
  };
}
