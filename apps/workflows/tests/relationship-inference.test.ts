// Tests for runRelationshipInference (workflows-relationship-inference) — the
// pure per-base driver. The synced-view heuristic runs engine-side; this only
// fans out per base + isolates per-base failures.

import { describe, expect, it, vi } from "vitest";
import {
  runRelationshipInference,
  type PerBaseSyncResult,
} from "../trigger/tasks/relationship-inference";

const r = (over: Partial<PerBaseSyncResult> = {}): PerBaseSyncResult => ({
  inserted: 0,
  refreshed: 0,
  skipped: 0,
  proposed: 0,
  ...over,
});

describe("runRelationshipInference", () => {
  it("calls syncBase once per base and aggregates totals", async () => {
    const syncBase = vi.fn(async (baseId: string) =>
      baseId === "appA" ? r({ inserted: 2, proposed: 3 }) : r({ refreshed: 1, skipped: 1, proposed: 2 }),
    );
    const out = await runRelationshipInference(
      { spaceId: "s1", runId: "run1", baseIds: ["appA", "appB"] },
      { syncBase },
    );
    expect(syncBase).toHaveBeenCalledTimes(2);
    expect(out.basesProcessed).toBe(2);
    expect(out.totals).toEqual({ inserted: 2, refreshed: 1, skipped: 1, proposed: 5 });
    expect(out.errors).toEqual([]);
  });

  it("isolates a per-base failure and still processes the rest", async () => {
    const syncBase = vi.fn(async (baseId: string) => {
      if (baseId === "appBad") throw new Error("boom");
      return r({ inserted: 1, proposed: 1 });
    });
    const out = await runRelationshipInference(
      { spaceId: "s1", runId: "run1", baseIds: ["appBad", "appOk"] },
      { syncBase },
    );
    expect(out.basesProcessed).toBe(1);
    expect(out.totals).toEqual({ inserted: 1, refreshed: 0, skipped: 0, proposed: 1 });
    expect(out.errors).toEqual([{ baseId: "appBad", message: "boom" }]);
  });

  it("handles an empty base list", async () => {
    const syncBase = vi.fn();
    const out = await runRelationshipInference(
      { spaceId: "s1", runId: "run1", baseIds: [] },
      { syncBase },
    );
    expect(syncBase).not.toHaveBeenCalled();
    expect(out).toEqual({
      basesProcessed: 0,
      totals: { inserted: 0, refreshed: 0, skipped: 0, proposed: 0 },
      errors: [],
    });
  });
});
