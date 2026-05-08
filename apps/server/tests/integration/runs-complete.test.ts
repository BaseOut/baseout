// Pure-function tests for the run-complete orchestration (Phase 8b).
//
// Mirrors the Phase 7 / 8a testing pattern: extract validation + state
// transitions into `processRunComplete(input, deps)` and inject DB queries
// as discrete dep functions. Tests use vi.fn() for every dep so they cover
// all paths cheaply without touching Postgres.
//
// Routing tests (401 missing token, 400 malformed runId, 405 non-POST,
// 400 invalid body) live in runs-complete-route.test.ts.
//
// Idempotency design (Option J — no schema change beyond the existing
// trigger_run_ids jsonb column):
//   - applyPerBaseCompletion atomically removes triggerRunId from
//     trigger_run_ids if present and increments per-run counters.
//   - If triggerRunId is NOT in the array → returns null → caller treats
//     as a 200-noop replay.
//   - Otherwise returns { remainingCount, hasFailure } reflecting the
//     row's POST-update state.
//   - When remainingCount === 0, processRunComplete computes the final
//     status (priority: hasFailure > input.status) and calls finalizeRun.

import { describe, expect, it, vi } from "vitest";
import { processRunComplete } from "../../src/lib/runs/complete";

const RUN_ID = "11111111-1111-1111-1111-111111111111";
const TRIGGER_RUN_ID_A = "run_aaaaaaaaaaaaaaaaaaaaaaaa";
const TRIGGER_RUN_ID_B = "run_bbbbbbbbbbbbbbbbbbbbbbbb";
const AT_BASE_ID = "appAAA111";
const NOW = new Date("2026-05-08T19:30:00.000Z");

interface DepsBag {
  fetchRunById: ReturnType<typeof vi.fn>;
  applyPerBaseCompletion: ReturnType<typeof vi.fn>;
  finalizeRun: ReturnType<typeof vi.fn>;
}

function makeDeps(): DepsBag {
  return {
    fetchRunById: vi.fn(async () => ({ id: RUN_ID })),
    applyPerBaseCompletion: vi.fn(async () => ({
      remainingCount: 0,
      hasFailure: false,
    })),
    finalizeRun: vi.fn(async () => {}),
  };
}

describe("processRunComplete — happy path", () => {
  it("finalizes the run as 'succeeded' when last completion lands and no prior failure", async () => {
    const deps = makeDeps();

    const result = await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesProcessed: 3,
        recordsProcessed: 42,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "finalized", finalStatus: "succeeded" });
    expect(deps.finalizeRun).toHaveBeenCalledTimes(1);
    expect(deps.finalizeRun).toHaveBeenCalledWith({
      runId: RUN_ID,
      finalStatus: "succeeded",
      completedAt: NOW,
    });
  });

  it("forwards counts + null failureMessage to applyPerBaseCompletion on success", async () => {
    const deps = makeDeps();

    await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesProcessed: 3,
        recordsProcessed: 42,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(deps.applyPerBaseCompletion).toHaveBeenCalledWith({
      runId: RUN_ID,
      triggerRunId: TRIGGER_RUN_ID_A,
      tablesProcessed: 3,
      recordsProcessed: 42,
      attachmentsProcessed: 0,
      failureMessage: null,
    });
  });

  it("returns 'partial' (no finalize) when other bases are still outstanding", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 1,
      hasFailure: false,
    }));

    const result = await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesProcessed: 3,
        recordsProcessed: 42,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "partial", remainingCount: 1 });
    expect(deps.finalizeRun).not.toHaveBeenCalled();
  });
});

describe("processRunComplete — idempotent replay", () => {
  it("returns 'noop' when applyPerBaseCompletion resolves to null (triggerRunId already processed)", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => null);

    const result = await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesProcessed: 3,
        recordsProcessed: 42,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "noop" });
    expect(deps.finalizeRun).not.toHaveBeenCalled();
  });
});

describe("processRunComplete — failure semantics", () => {
  it("passes failureMessage = body.errorMessage when status='failed'", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 1,
      hasFailure: true,
    }));

    await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "failed",
        tablesProcessed: 0,
        recordsProcessed: 0,
        attachmentsProcessed: 0,
        errorMessage: "lock_unavailable",
      },
      { ...deps, now: () => NOW },
    );

    expect(deps.applyPerBaseCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ failureMessage: "lock_unavailable" }),
    );
  });

  it("substitutes 'unknown_failure' when status='failed' but errorMessage is omitted", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 0,
      hasFailure: true,
    }));

    await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "failed",
        tablesProcessed: 0,
        recordsProcessed: 0,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(deps.applyPerBaseCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ failureMessage: "unknown_failure" }),
    );
  });

  it("finalizes as 'failed' when hasFailure=true regardless of this body's status", async () => {
    // Sticky: if a prior callback already recorded a failure, the LAST callback
    // (which might itself report 'succeeded') still flips the run to failed.
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 0,
      hasFailure: true,
    }));

    const result = await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_B,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesProcessed: 5,
        recordsProcessed: 100,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "finalized", finalStatus: "failed" });
    expect(deps.finalizeRun).toHaveBeenCalledWith({
      runId: RUN_ID,
      finalStatus: "failed",
      completedAt: NOW,
    });
  });
});

describe("processRunComplete — trial-state finalization", () => {
  it("finalizes as 'trial_complete' when last callback reports trial_complete and no failure", async () => {
    const deps = makeDeps();

    const result = await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "trial_complete",
        tablesProcessed: 5,
        recordsProcessed: 1000,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      kind: "finalized",
      finalStatus: "trial_complete",
    });
    expect(deps.finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({ finalStatus: "trial_complete" }),
    );
  });

  it("finalizes as 'trial_truncated' when last callback reports trial_truncated and no failure", async () => {
    const deps = makeDeps();

    const result = await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "trial_truncated",
        tablesProcessed: 5,
        recordsProcessed: 200,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      kind: "finalized",
      finalStatus: "trial_truncated",
    });
  });
});

describe("processRunComplete — validation failures", () => {
  it("returns run_not_found when fetchRunById resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchRunById = vi.fn(async () => null);

    const result = await processRunComplete(
      {
        runId: RUN_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesProcessed: 3,
        recordsProcessed: 42,
        attachmentsProcessed: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "run_not_found" });
    expect(deps.applyPerBaseCompletion).not.toHaveBeenCalled();
    expect(deps.finalizeRun).not.toHaveBeenCalled();
  });
});
