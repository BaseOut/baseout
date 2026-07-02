// buildCleanupPlan — pure orchestration for one cleanup pass
// (openspec/changes/server-retention-and-cleanup Phase C.2).
//
// Walks every Space with live (non-deleted, terminal) runs, resolves its policy
// (a persisted backup_retention_policies row, else the tier default) + tier-cap,
// runs decideDeletions, and assembles a flat delete-plan. All DB access is
// injected (BuildCleanupPlanDeps) so the orchestration is unit-testable without
// Postgres — the same seam as processRunDelete.
//
// This is the ENGINE half of cleanup: it only decides + plans (Worker-safe: DB
// reads only, no storage access). The apps/workflows cron consumes this plan and
// performs the actual StorageWriter.deletePrefix in the Node runtime, then calls
// back to /api/internal/cleanup-complete to flip deleted_at. Split this way
// because Cloudflare Workers cannot reach R2/BYOS storage — only the Trigger.dev
// Node runner can (CLAUDE.md §3.7 / §6).

import type { RunPrefixesAndStorage } from "../runs/delete";
import { decideDeletions, type RetentionRun } from "./decide-deletions";
import { getDefaultPolicy } from "./policy-defaults";
import { getTierCapDays, type Tier } from "./tier-cap";
import type { RetentionPolicyValues } from "./types";

/** One run to prune, with everything the workflows cron needs to delete it. */
export interface CleanupRunPlan {
  runId: string;
  spaceId: string;
  storageType: string;
  prefixes: string[];
}

export interface CleanupPlan {
  runs: CleanupRunPlan[];
}

export interface BuildCleanupPlanDeps {
  /** Distinct space_ids that have ≥1 non-deleted backup run. */
  listSpacesWithLiveRuns: () => Promise<string[]>;
  /** The Space's org subscription tier (for cap + default policy); null if none. */
  resolveSpaceTier: (spaceId: string) => Promise<Tier | null>;
  /** The Space's persisted retention policy, or null to use the tier default. */
  loadPolicy: (spaceId: string) => Promise<RetentionPolicyValues | null>;
  /** Live (non-deleted, terminal) runs for the Space. */
  loadRunsForSpace: (spaceId: string) => Promise<RetentionRun[]>;
  /** Per-base storage prefixes + storage_type for a run (reuses the run-delete join). */
  computeRunPrefixes: (runId: string) => Promise<RunPrefixesAndStorage>;
}

export async function buildCleanupPlan(
  deps: BuildCleanupPlanDeps,
  now: Date,
): Promise<CleanupPlan> {
  const plan: CleanupRunPlan[] = [];
  const spaceIds = await deps.listSpacesWithLiveRuns();

  for (const spaceId of spaceIds) {
    const tier = await deps.resolveSpaceTier(spaceId);
    const policy = (await deps.loadPolicy(spaceId)) ?? getDefaultPolicy(tier);
    const cap = getTierCapDays(tier);
    const runs = await deps.loadRunsForSpace(spaceId);

    const decision = decideDeletions(runs, policy, cap, now);
    for (const runId of decision.delete) {
      const { prefixes, storageType } = await deps.computeRunPrefixes(runId);
      plan.push({ runId, spaceId, storageType, prefixes });
    }
  }

  return { runs: plan };
}
