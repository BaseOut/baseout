// Unit tests for buildCleanupPlan (server-retention-and-cleanup Phase C.2).
//
// buildCleanupPlan is the pure orchestration for one cleanup pass: it walks
// every Space with live runs, resolves each Space's policy (persisted row, else
// the tier default) + tier-cap, runs decideDeletions, and assembles a flat
// delete-plan of { runId, spaceId, storageType, prefixes }. All DB access is
// injected as deps so the orchestration is testable without Postgres — the same
// pattern as processRunDelete. The actual file deletion happens later in the
// apps/workflows cron (Node runtime); this engine half only decides + plans.

import { describe, expect, it, vi } from "vitest";
import { buildCleanupPlan } from "../../../src/lib/retention/build-cleanup-plan";
import type { BuildCleanupPlanDeps } from "../../../src/lib/retention/build-cleanup-plan";
import type { RetentionRun } from "../../../src/lib/retention/decide-deletions";

const NOW = new Date("2026-06-27T00:00:00.000Z");
const DAY_MS = 86_400_000;

function run(id: string, ageDays: number, isTrial = false): RetentionRun {
  return { id, startedAt: new Date(NOW.getTime() - ageDays * DAY_MS), isTrial };
}

function deps(overrides: Partial<BuildCleanupPlanDeps>): BuildCleanupPlanDeps {
  return {
    listSpacesWithLiveRuns: vi.fn(async () => []),
    resolveSpaceTier: vi.fn(async () => "pro" as const),
    loadPolicy: vi.fn(async () => null),
    loadRunsForSpace: vi.fn(async () => []),
    computeRunPrefixes: vi.fn(async (runId: string) => ({
      prefixes: [`org/space/base/${runId}/`],
      storageType: "r2_managed",
    })),
    ...overrides,
  };
}

describe("buildCleanupPlan", () => {
  it("returns an empty plan when no Space has live runs", async () => {
    const plan = await buildCleanupPlan(deps({}), NOW);
    expect(plan.runs).toEqual([]);
  });

  it("plans deletions for a Space using its persisted policy", async () => {
    // basic keepLastN=2 over 4 runs → delete the 2 oldest.
    const d = deps({
      listSpacesWithLiveRuns: vi.fn(async () => ["space-1"]),
      loadPolicy: vi.fn(async () => ({ tier: "basic" as const, keepLastN: 2 })),
      loadRunsForSpace: vi.fn(async () => [
        run("r1", 1),
        run("r2", 2),
        run("r3", 3),
        run("r4", 4),
      ]),
    });
    const plan = await buildCleanupPlan(d, NOW);
    const deletedIds = plan.runs.map((r) => r.runId).sort();
    expect(deletedIds).toEqual(["r3", "r4"]);
    expect(plan.runs[0]).toMatchObject({
      spaceId: "space-1",
      storageType: "r2_managed",
    });
    expect(plan.runs[0]!.prefixes.length).toBeGreaterThan(0);
  });

  it("falls back to the tier-default policy when a Space has no persisted row", async () => {
    // No policy row + starter tier → getDefaultPolicy = basic keepLastN=10.
    // 12 runs → delete the 2 oldest.
    const runs = Array.from({ length: 12 }, (_, i) => run(`r${i}`, i + 1));
    const loadPolicy = vi.fn(async () => null);
    const d = deps({
      listSpacesWithLiveRuns: vi.fn(async () => ["space-1"]),
      resolveSpaceTier: vi.fn(async () => "starter" as const),
      loadPolicy,
      loadRunsForSpace: vi.fn(async () => runs),
    });
    const plan = await buildCleanupPlan(d, NOW);
    expect(plan.runs.map((r) => r.runId).sort()).toEqual(["r10", "r11"]);
    expect(loadPolicy).toHaveBeenCalledWith("space-1");
  });

  it("enforces the tier-cap even when the policy would keep everything", async () => {
    // basic keepLastN=100 keeps all, but starter cap = 30d deletes the 40d run.
    const d = deps({
      listSpacesWithLiveRuns: vi.fn(async () => ["space-1"]),
      resolveSpaceTier: vi.fn(async () => "starter" as const),
      loadPolicy: vi.fn(async () => ({ tier: "basic" as const, keepLastN: 100 })),
      loadRunsForSpace: vi.fn(async () => [run("fresh", 10), run("stale", 40)]),
    });
    const plan = await buildCleanupPlan(d, NOW);
    expect(plan.runs.map((r) => r.runId)).toEqual(["stale"]);
  });

  it("aggregates plans across multiple Spaces", async () => {
    const d = deps({
      listSpacesWithLiveRuns: vi.fn(async () => ["space-1", "space-2"]),
      loadPolicy: vi.fn(async () => ({ tier: "basic" as const, keepLastN: 1 })),
      loadRunsForSpace: vi.fn(async (spaceId: string) =>
        spaceId === "space-1"
          ? [run("a1", 1), run("a2", 2)]
          : [run("b1", 1), run("b2", 2), run("b3", 3)],
      ),
    });
    const plan = await buildCleanupPlan(d, NOW);
    expect(plan.runs.map((r) => r.runId).sort()).toEqual(["a2", "b2", "b3"]);
  });

  it("does not call computeRunPrefixes for runs that are kept", async () => {
    const computeRunPrefixes = vi.fn(async (runId: string) => ({
      prefixes: [`p/${runId}/`],
      storageType: "r2_managed",
    }));
    const d = deps({
      listSpacesWithLiveRuns: vi.fn(async () => ["space-1"]),
      loadPolicy: vi.fn(async () => ({ tier: "basic" as const, keepLastN: 1 })),
      loadRunsForSpace: vi.fn(async () => [run("keep", 1), run("drop", 2)]),
      computeRunPrefixes,
    });
    await buildCleanupPlan(d, NOW);
    expect(computeRunPrefixes).toHaveBeenCalledTimes(1);
    expect(computeRunPrefixes).toHaveBeenCalledWith("drop");
  });
});
