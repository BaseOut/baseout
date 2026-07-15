// Pure tests for decideReconciliation (server-run-reconciliation). No DB, no
// Trigger.dev — the sweep wiring injects both. Placed under
// tests/integration/** so the server test runner picks it up.
//
// Ground truth pinned first (task 1.1): trigger_run_ids is a PENDING set —
// /complete removes each id as its per-base completion lands and finalizes at
// []. So a stuck run retains exactly the ids that never completed; [] on a
// non-terminal run means every completion arrived but finalizeRun never ran.

import { describe, expect, it } from "vitest";
import {
  decideReconciliation,
  TERMINAL_TRIGGER_STATUSES,
  type ReconcileRun,
} from "../../src/lib/runs/reconcile";

const NOW = new Date("2026-07-15T03:00:00.000Z");
const MIN = 60_000;

function run(over: Partial<ReconcileRun> = {}): ReconcileRun {
  return {
    id: "run-1",
    status: "running",
    startedAt: new Date(NOW.getTime() - 30 * MIN),
    createdAt: new Date(NOW.getTime() - 31 * MIN),
    errorMessage: null,
    triggerRunIds: ["tr_a", "tr_b"],
    ...over,
  };
}

describe("decideReconciliation — leave-alone paths", () => {
  it("inside the grace window → leave", () => {
    const d = decideReconciliation(run({ startedAt: new Date(NOW.getTime() - 5 * MIN) }), ["EXPIRED", "EXPIRED"], NOW);
    expect(d.action).toBe("leave");
  });

  it("any task still active → leave", () => {
    const d = decideReconciliation(run(), ["EXPIRED", "EXECUTING"], NOW);
    expect(d.action).toBe("leave");
  });

  it("queued task → leave", () => {
    expect(decideReconciliation(run(), ["QUEUED", "COMPLETED"], NOW).action).toBe("leave");
  });

  it("a lookup failure (null state) → leave this pass", () => {
    expect(decideReconciliation(run(), [null, "EXPIRED"], NOW).action).toBe("leave");
  });

  it("an UNRECOGNIZED future status is treated as active (safe default) → leave", () => {
    expect(decideReconciliation(run(), ["SOME_FUTURE_STATE", "EXPIRED"], NOW).action).toBe("leave");
  });
});

describe("decideReconciliation — terminalization", () => {
  it("all tasks EXPIRED → fail naming the states (the 2026-07-14 incident)", () => {
    const d = decideReconciliation(run(), ["EXPIRED", "EXPIRED"], NOW);
    expect(d.action).toBe("fail");
    if (d.action !== "fail") return;
    expect(d.errorMessage).toContain("EXPIRED");
    expect(d.errorMessage.toLowerCase()).toContain("reconciled");
  });

  it("tasks COMPLETED but completions never landed → fail(missed completion)", () => {
    const d = decideReconciliation(run(), ["COMPLETED", "COMPLETED"], NOW);
    expect(d.action).toBe("fail");
    if (d.action !== "fail") return;
    expect(d.errorMessage).toContain("COMPLETED");
  });

  it("mixed terminal states (CRASHED + EXPIRED) → fail listing both", () => {
    const d = decideReconciliation(run(), ["CRASHED", "EXPIRED"], NOW);
    expect(d.action).toBe("fail");
    if (d.action !== "fail") return;
    expect(d.errorMessage).toContain("CRASHED");
    expect(d.errorMessage).toContain("EXPIRED");
  });

  it("every documented terminal status is in the terminal set", () => {
    for (const s of ["COMPLETED", "CANCELED", "FAILED", "CRASHED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT", "INTERRUPTED"]) {
      expect(TERMINAL_TRIGGER_STATUSES.has(s), s).toBe(true);
    }
  });
});

describe("decideReconciliation — empty/null pending set", () => {
  it("[] with no error_message → finalize succeeded (completions all landed, finalize crashed)", () => {
    const d = decideReconciliation(run({ triggerRunIds: [] }), [], NOW);
    expect(d).toEqual({ action: "finalize", finalStatus: "succeeded" });
  });

  it("[] with a sticky error_message → finalize failed", () => {
    const d = decideReconciliation(run({ triggerRunIds: [], errorMessage: "base X: boom" }), [], NOW);
    expect(d).toEqual({ action: "finalize", finalStatus: "failed" });
  });

  it("null ids (fan-out never recorded) → fail only after the LONGER window", () => {
    const young = run({ triggerRunIds: null, startedAt: new Date(NOW.getTime() - 30 * MIN) });
    expect(decideReconciliation(young, [], NOW).action).toBe("leave");
    const old = run({ triggerRunIds: null, startedAt: new Date(NOW.getTime() - 90 * MIN) });
    const d = decideReconciliation(old, [], NOW);
    expect(d.action).toBe("fail");
    if (d.action !== "fail") return;
    expect(d.errorMessage).toContain("no tasks recorded");
  });

  it("a never-started queued row anchors on created_at", () => {
    const d = decideReconciliation(
      run({ status: "queued", startedAt: null, createdAt: new Date(NOW.getTime() - 30 * MIN), triggerRunIds: ["tr_a"] }),
      ["EXPIRED"],
      NOW,
    );
    expect(d.action).toBe("fail");
  });

  it("a QUEUED row with an empty set is NOT finalize-succeeded — restore_runs defaults to '{}'", () => {
    // Within the long window: leave. Past it: fail(no tasks). Never 'succeeded'.
    const young = run({ status: "queued", startedAt: null, createdAt: new Date(NOW.getTime() - 30 * MIN), triggerRunIds: [] });
    expect(decideReconciliation(young, [], NOW).action).toBe("leave");
    const old = run({ status: "queued", startedAt: null, createdAt: new Date(NOW.getTime() - 90 * MIN), triggerRunIds: [] });
    const d = decideReconciliation(old, [], NOW);
    expect(d.action).toBe("fail");
  });
});

// ── sweep orchestration (deps injected) ──

import { vi } from "vitest";
import {
  runReconcileSweep,
  type ReconcileSweepDeps,
} from "../../src/lib/runs/reconcile-sweep";

function sweepDeps(over: Partial<ReconcileSweepDeps> = {}): ReconcileSweepDeps & {
  applyDecision: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
} {
  return {
    listStuckRuns: vi.fn(async (kind: string) =>
      kind === "backup" ? [run({ triggerRunIds: ["tr_a"] })] : [],
    ),
    lookupTaskStatuses: vi.fn(async () => ["EXPIRED"]),
    applyDecision: vi.fn(async () => true),
    log: vi.fn(),
    now: () => NOW,
    ...over,
  } as ReconcileSweepDeps & { applyDecision: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn> };
}

describe("runReconcileSweep", () => {
  it("reconciles an expired-task run and logs one summary", async () => {
    const deps = sweepDeps();
    const result = await runReconcileSweep(deps);
    expect(result).toMatchObject({ scanned: 1, reconciled: 1, leftAlone: 0, errors: 0 });
    expect(deps.applyDecision).toHaveBeenCalledWith(
      "backup",
      "run-1",
      expect.objectContaining({ action: "fail" }),
    );
    expect(deps.log.mock.calls[0]![0]).toMatchObject({ event: "run_reconcile_sweep", reconciled: 1 });
  });

  it("covers the restore mirror with the same decision function", async () => {
    const deps = sweepDeps({
      listStuckRuns: vi.fn(async (kind: string) =>
        kind === "restore" ? [run({ id: "restore-1", triggerRunIds: ["tr_r"] })] : [],
      ),
    });
    const result = await runReconcileSweep(deps);
    expect(result.reconciled).toBe(1);
    expect(deps.applyDecision).toHaveBeenCalledWith("restore", "restore-1", expect.anything());
  });

  it("a lost guarded-UPDATE race counts raceLost, not reconciled", async () => {
    const deps = sweepDeps({ applyDecision: vi.fn(async () => false) });
    const result = await runReconcileSweep(deps);
    expect(result).toMatchObject({ reconciled: 0, raceLost: 1 });
  });

  it("a throwing lookup isolates to that run (errors++) and the sweep continues", async () => {
    const deps = sweepDeps({
      listStuckRuns: vi.fn(async (kind: string) =>
        kind === "backup"
          ? [run({ id: "boom", triggerRunIds: ["tr_x"] }), run({ id: "ok", triggerRunIds: ["tr_y"] })]
          : [],
      ),
      lookupTaskStatuses: vi
        .fn()
        .mockRejectedValueOnce(new Error("trigger api down"))
        .mockResolvedValueOnce(["EXPIRED"]),
    });
    const result = await runReconcileSweep(deps);
    expect(result).toMatchObject({ scanned: 2, errors: 1, reconciled: 1 });
  });

  it("active tasks are left alone", async () => {
    const deps = sweepDeps({ lookupTaskStatuses: vi.fn(async () => ["EXECUTING"]) });
    const result = await runReconcileSweep(deps);
    expect(result).toMatchObject({ reconciled: 0, leftAlone: 1 });
    expect(deps.applyDecision).not.toHaveBeenCalled();
  });
});
