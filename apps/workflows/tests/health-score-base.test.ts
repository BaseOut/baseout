// Pure-orchestration tests for the Health scoring task
// (openspec/changes/workflows-health-scoring). The Claude call + engine POST are
// injected deps; this pins the per-metric loop, clamping, failure isolation, and
// the sync payload.

import { describe, expect, it, vi } from "vitest";
import {
  runHealthScoreBase,
  type HealthScoreBaseDeps,
} from "../trigger/tasks/health-score-base";

const INPUT = {
  spaceId: "space-1",
  baseId: "appXYZ",
  runId: "run-1",
  schemaContext: "Tables: Tasks(Name:text, Owner:singleSelect)",
  metrics: [
    { ruleId: "r1", prompt: "p1", entityTier: "field" },
    { ruleId: "r2", prompt: "p2", entityTier: "table" },
  ],
};

function deps(over: Partial<HealthScoreBaseDeps> = {}): HealthScoreBaseDeps & {
  scoreMetric: ReturnType<typeof vi.fn>;
  postHealthSync: ReturnType<typeof vi.fn>;
} {
  return {
    scoreMetric: vi.fn(async () => ({ score: 80, findings: [] })),
    postHealthSync: vi.fn(async () => {}),
    ...over,
  } as never;
}

describe("runHealthScoreBase", () => {
  it("scores each enabled metric and syncs the results", async () => {
    const d = deps();
    const result = await runHealthScoreBase(INPUT, d);

    expect(d.scoreMetric).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ metricsScored: 2, metricsFailed: 0 });
    expect(d.postHealthSync).toHaveBeenCalledWith({
      baseId: "appXYZ",
      runId: "run-1",
      metrics: [
        { ruleId: "r1", score: 80, findings: [] },
        { ruleId: "r2", score: 80, findings: [] },
      ],
    });
  });

  it("clamps and rounds scores to 0–100", async () => {
    const scores = [150, -10, 87.6];
    let i = 0;
    const d = deps({
      scoreMetric: vi.fn(async () => ({ score: scores[i++]!, findings: [] })),
      postHealthSync: vi.fn(async () => {}),
    });
    const input = {
      ...INPUT,
      metrics: [
        { ruleId: "a", prompt: "p", entityTier: "base" },
        { ruleId: "b", prompt: "p", entityTier: "base" },
        { ruleId: "c", prompt: "p", entityTier: "base" },
      ],
    };
    await runHealthScoreBase(input, d);
    const synced = d.postHealthSync.mock.calls[0]![0].metrics.map((m: { score: number }) => m.score);
    expect(synced).toEqual([100, 0, 88]);
  });

  it("skips a metric whose scorer throws, still scoring the rest", async () => {
    const d = deps({
      scoreMetric: vi.fn(async ({ prompt }: { prompt: string }) => {
        if (prompt === "p2") throw new Error("model error");
        return { score: 70, findings: [{ severity: "low", message: "ok" }] };
      }),
      postHealthSync: vi.fn(async () => {}),
    });
    const result = await runHealthScoreBase(INPUT, d);

    expect(result).toEqual({ metricsScored: 1, metricsFailed: 1 });
    expect(d.postHealthSync).toHaveBeenCalledWith({
      baseId: "appXYZ",
      runId: "run-1",
      metrics: [{ ruleId: "r1", score: 70, findings: [{ severity: "low", message: "ok" }] }],
    });
  });

  it("does not sync when there are no metrics", async () => {
    const d = deps();
    const result = await runHealthScoreBase({ ...INPUT, metrics: [] }, d);
    expect(result).toEqual({ metricsScored: 0, metricsFailed: 0 });
    expect(d.postHealthSync).not.toHaveBeenCalled();
  });
});
