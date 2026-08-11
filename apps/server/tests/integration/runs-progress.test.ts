// Pure-function tests for the run-progress orchestration (Phase 10d).
//
// Mirrors the Phase 8a / 8b pattern: extract the validation + state-transition
// logic into `processRunProgress(input, deps)` and inject every side-effect
// (the atomic SQL UPDATE) as a vi.fn() dep. Routing-layer tests (401, 405,
// 400, etc.) live in runs-progress-route.test.ts.
//
// Design (Option per the plan):
//   - `applyProgress` is a single dep. The route wires it to a CTE-shaped
//     SQL UPDATE that distinguishes three outcomes via RETURNING:
//       (a) no row by that id     → exists=false, updated=false → 404 run_not_found
//       (b) row exists, terminal  → exists=true,  updated=false → 200 noop
//       (c) row exists, running   → exists=true,  updated=true  → 200 applied
//   - Stray events after `/complete` flipped status to terminal noop quietly.
//     Trigger.dev page retries are accepted as advisory drift (counters may
//     briefly over-count; `/complete` overwrites with the authoritative
//     per-base totals when the base finishes).

import { describe, expect, it, vi } from "vitest";
import { processRunProgress } from "../../src/lib/runs/progress";

const RUN_ID = "11111111-1111-1111-1111-111111111111";
const TRIGGER_RUN_ID = "run_aaaaaaaaaaaaaaaaaaaaaaaa";
const AT_BASE_ID = "appAAA111";

describe("processRunProgress", () => {
  it("returns applied when the row exists and is running", async () => {
    const applyProgress = vi.fn(async () => ({
      exists: true,
      updated: true,
    }));

    const result = await processRunProgress(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID,
        atBaseId: AT_BASE_ID,
        recordsAppended: 100,
        tableCompleted: false,
      },
      { applyProgress },
    );

    expect(result).toEqual({ ok: true, kind: "applied" });
    expect(applyProgress).toHaveBeenCalledOnce();
    expect(applyProgress).toHaveBeenCalledWith({
      runId: RUN_ID,
      recordsAppended: 100,
      tableCompleted: false,
    });
  });

  it("returns run_not_found when the row does not exist", async () => {
    const applyProgress = vi.fn(async () => ({
      exists: false,
      updated: false,
    }));

    const result = await processRunProgress(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID,
        atBaseId: AT_BASE_ID,
        recordsAppended: 50,
        tableCompleted: true,
      },
      { applyProgress },
    );

    expect(result).toEqual({ ok: false, error: "run_not_found" });
  });

  it("returns noop when the row exists but is already terminal", async () => {
    // A stray /progress arriving after /complete already flipped status to
    // 'succeeded' / 'failed' / 'trial_*' — the WHERE status='running' guard
    // in the SQL UPDATE matches no rows, so updated=false. We treat this
    // as a silent noop so the runner's fire-and-forget POST doesn't retry.
    const applyProgress = vi.fn(async () => ({
      exists: true,
      updated: false,
    }));

    const result = await processRunProgress(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID,
        atBaseId: AT_BASE_ID,
        recordsAppended: 100,
        tableCompleted: false,
      },
      { applyProgress },
    );

    expect(result).toEqual({ ok: true, kind: "noop" });
  });

  it("forwards tableCompleted=true to the dep", async () => {
    const applyProgress = vi.fn(async () => ({
      exists: true,
      updated: true,
    }));

    await processRunProgress(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID,
        atBaseId: AT_BASE_ID,
        recordsAppended: 0,
        tableCompleted: true,
      },
      { applyProgress },
    );

    expect(applyProgress).toHaveBeenCalledWith({
      runId: RUN_ID,
      recordsAppended: 0,
      tableCompleted: true,
    });
  });

  it("does not pass triggerRunId or atBaseId to applyProgress (advisory only)", async () => {
    // The pure function takes triggerRunId + atBaseId for tracing/logging
    // but the SQL doesn't gate on them — counter bumps are advisory,
    // /complete is the authoritative writer.
    const applyProgress = vi.fn(async () => ({
      exists: true,
      updated: true,
    }));

    await processRunProgress(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID,
        atBaseId: AT_BASE_ID,
        recordsAppended: 42,
        tableCompleted: false,
      },
      { applyProgress },
    );

    const callArgs = applyProgress.mock.calls[0]![0];
    expect(callArgs).not.toHaveProperty("triggerRunId");
    expect(callArgs).not.toHaveProperty("atBaseId");
  });
});
