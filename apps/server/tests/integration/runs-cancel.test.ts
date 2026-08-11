// Pure-function tests for the run-cancel orchestration (Phase 8.cancel).
//
// Mirrors the Phase 8a/8b testing pattern: validation + state transitions
// are extracted into processRunCancel(input, deps); tests inject vi.fn()
// deps for every side-effect so all paths cover cheaply without Postgres
// or Trigger.dev.
//
// State machine:
//   queued    → cancelling → cancelled   (engine route writes cancelling,
//                                         then cancelled after Trigger.dev acks)
//   running   → cancelling → cancelled
//   anything-terminal → 409 (caller must not double-cancel)
//
// Routing tests (401 missing token, 405 non-POST, 400 invalid runId) live
// in runs-cancel-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { processRunCancel } from "../../src/lib/runs/cancel";

const RUN_ID = "22222222-2222-2222-2222-222222222222";
const TRIGGER_RUN_ID_A = "run_aaaaaaaaaaaaaaaaaaaaaaaa";
const TRIGGER_RUN_ID_B = "run_bbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = new Date("2026-05-12T17:30:00.000Z");

interface DepsBag {
  fetchRunForCancel: ReturnType<typeof vi.fn>;
  markRunCancelling: ReturnType<typeof vi.fn>;
  cancelTriggerRun: ReturnType<typeof vi.fn>;
  markRunCancelled: ReturnType<typeof vi.fn>;
}

function makeDeps(): DepsBag {
  return {
    fetchRunForCancel: vi.fn(async () => ({
      id: RUN_ID,
      status: "running",
      triggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    })),
    markRunCancelling: vi.fn(async () => true), // CAS won
    cancelTriggerRun: vi.fn(async () => undefined),
    markRunCancelled: vi.fn(async () => undefined),
  };
}

describe("processRunCancel — happy paths", () => {
  it("cancels a running run: fetch → cancelling → triggers.cancel × N → cancelled", async () => {
    const deps = makeDeps();

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      cancelledTriggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    });

    expect(deps.fetchRunForCancel).toHaveBeenCalledWith(RUN_ID);
    expect(deps.markRunCancelling).toHaveBeenCalledWith(RUN_ID);
    expect(deps.cancelTriggerRun).toHaveBeenCalledTimes(2);
    expect(deps.cancelTriggerRun).toHaveBeenNthCalledWith(1, TRIGGER_RUN_ID_A);
    expect(deps.cancelTriggerRun).toHaveBeenNthCalledWith(2, TRIGGER_RUN_ID_B);
    expect(deps.markRunCancelled).toHaveBeenCalledWith({
      runId: RUN_ID,
      completedAt: NOW,
    });
  });

  it("cancels a queued run with no triggerRunIds: skips Trigger.dev SDK calls", async () => {
    const deps = makeDeps();
    deps.fetchRunForCancel = vi.fn(async () => ({
      id: RUN_ID,
      status: "queued",
      triggerRunIds: null, // never fanned out
    }));

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, cancelledTriggerRunIds: [] });
    expect(deps.markRunCancelling).toHaveBeenCalledWith(RUN_ID);
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
    expect(deps.markRunCancelled).toHaveBeenCalledWith({
      runId: RUN_ID,
      completedAt: NOW,
    });
  });

  it("cancels a queued run whose triggerRunIds is an empty array", async () => {
    const deps = makeDeps();
    deps.fetchRunForCancel = vi.fn(async () => ({
      id: RUN_ID,
      status: "queued",
      triggerRunIds: [],
    }));

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, cancelledTriggerRunIds: [] });
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
  });
});

describe("processRunCancel — error gates", () => {
  it("returns run_not_found when fetchRunForCancel resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchRunForCancel = vi.fn(async () => null);

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "run_not_found" });
    expect(deps.markRunCancelling).not.toHaveBeenCalled();
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
    expect(deps.markRunCancelled).not.toHaveBeenCalled();
  });

  it.each([
    "succeeded",
    "failed",
    "trial_complete",
    "trial_truncated",
    "cancelled",
  ])("returns run_already_terminal when run.status is %s", async (status) => {
    const deps = makeDeps();
    deps.fetchRunForCancel = vi.fn(async () => ({
      id: RUN_ID,
      status,
      triggerRunIds: [TRIGGER_RUN_ID_A],
    }));

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "run_already_terminal" });
    expect(deps.markRunCancelling).not.toHaveBeenCalled();
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
    expect(deps.markRunCancelled).not.toHaveBeenCalled();
  });

  it("returns run_already_terminal when run.status is already 'cancelling' (idempotent double-click)", async () => {
    const deps = makeDeps();
    deps.fetchRunForCancel = vi.fn(async () => ({
      id: RUN_ID,
      status: "cancelling",
      triggerRunIds: [TRIGGER_RUN_ID_A],
    }));

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "run_already_terminal" });
  });

  it("returns run_already_terminal when CAS to 'cancelling' loses the race", async () => {
    // Two concurrent cancel calls. The first wins; the second's
    // markRunCancelling UPDATE matches no rows (WHERE status IN
    // ('queued','running')) and returns false. The pure function maps
    // that to the same 409 we'd return for "already terminal".
    const deps = makeDeps();
    deps.markRunCancelling = vi.fn(async () => false);

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "run_already_terminal" });
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
    expect(deps.markRunCancelled).not.toHaveBeenCalled();
  });
});

describe("processRunCancel — Trigger.dev failures", () => {
  it("swallows a single runs.cancel rejection and continues to the next id, then flips to cancelled", async () => {
    // Per design.md: `runs.cancel` 404 means the task already finished —
    // log + swallow. We still want to flip the run to 'cancelled'.
    const deps = makeDeps();
    deps.cancelTriggerRun = vi.fn(async (id: string) => {
      if (id === TRIGGER_RUN_ID_A) {
        throw new Error("trigger_run_not_found");
      }
    });

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      cancelledTriggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    });
    expect(deps.cancelTriggerRun).toHaveBeenCalledTimes(2);
    expect(deps.markRunCancelled).toHaveBeenCalledWith({
      runId: RUN_ID,
      completedAt: NOW,
    });
  });

  it("flips to cancelled even when every runs.cancel rejects", async () => {
    // The user's intent is to cancel. Whatever Trigger.dev reports, the
    // engine must move the run to terminal. The actual compute may
    // continue on Trigger.dev's side; /complete will no-op against a
    // terminal row.
    const deps = makeDeps();
    deps.cancelTriggerRun = vi.fn(async () => {
      throw new Error("network");
    });

    const result = await processRunCancel(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      cancelledTriggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    });
    expect(deps.markRunCancelled).toHaveBeenCalledOnce();
  });
});
