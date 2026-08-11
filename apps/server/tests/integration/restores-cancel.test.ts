// Pure-function tests for the restore-cancel orchestration (server-restore Phase D.1).
//
// Mirrors runs-cancel.test.ts for the restore lifecycle. processRestoreCancel
// implements the same CAS-based cancel state machine but targets restore_runs:
//
//   queued    → cancelling → cancelled   (no trigger fan-out for queued)
//   running   → cancelling → cancelled   (trigger.dev cancel × N)
//   anything else → 409 (already terminal or already cancelling)
//
// Routing-layer tests (401 missing token, 405 non-POST, 400 invalid UUID) live
// in restores-cancel-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { processRestoreCancel } from "../../src/lib/restores/cancel";

const RESTORE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TRIGGER_RUN_ID_A = "run_aaaaaaaaaaaaaaaaaaaaaaaa";
const TRIGGER_RUN_ID_B = "run_bbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = new Date("2026-06-26T10:00:00.000Z");

interface DepsBag {
  fetchRestoreForCancel: ReturnType<typeof vi.fn>;
  markRestoreCancelling: ReturnType<typeof vi.fn>;
  cancelTriggerRun: ReturnType<typeof vi.fn>;
  markRestoreCancelled: ReturnType<typeof vi.fn>;
}

function makeDeps(): DepsBag {
  return {
    fetchRestoreForCancel: vi.fn(async () => ({
      id: RESTORE_ID,
      status: "running",
      triggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    })),
    markRestoreCancelling: vi.fn(async () => true), // CAS won
    cancelTriggerRun: vi.fn(async () => undefined),
    markRestoreCancelled: vi.fn(async () => undefined),
  };
}

describe("processRestoreCancel — happy paths", () => {
  it("cancels a running restore: fetch → cancelling → triggers.cancel × N → cancelled", async () => {
    const deps = makeDeps();

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      cancelledTriggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    });

    expect(deps.fetchRestoreForCancel).toHaveBeenCalledWith(RESTORE_ID);
    expect(deps.markRestoreCancelling).toHaveBeenCalledWith(RESTORE_ID);
    expect(deps.cancelTriggerRun).toHaveBeenCalledTimes(2);
    expect(deps.cancelTriggerRun).toHaveBeenNthCalledWith(1, TRIGGER_RUN_ID_A);
    expect(deps.cancelTriggerRun).toHaveBeenNthCalledWith(2, TRIGGER_RUN_ID_B);
    expect(deps.markRestoreCancelled).toHaveBeenCalledWith({
      restoreId: RESTORE_ID,
      cancelledAt: NOW,
    });
  });

  it("cancels a queued restore with no triggerRunIds: skips Trigger.dev SDK calls", async () => {
    const deps = makeDeps();
    deps.fetchRestoreForCancel = vi.fn(async () => ({
      id: RESTORE_ID,
      status: "queued",
      triggerRunIds: null, // never fanned out
    }));

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, cancelledTriggerRunIds: [] });
    expect(deps.markRestoreCancelling).toHaveBeenCalledWith(RESTORE_ID);
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
    expect(deps.markRestoreCancelled).toHaveBeenCalledWith({
      restoreId: RESTORE_ID,
      cancelledAt: NOW,
    });
  });

  it("cancels a queued restore whose triggerRunIds is an empty array", async () => {
    const deps = makeDeps();
    deps.fetchRestoreForCancel = vi.fn(async () => ({
      id: RESTORE_ID,
      status: "queued",
      triggerRunIds: [],
    }));

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, cancelledTriggerRunIds: [] });
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
  });
});

describe("processRestoreCancel — error gates", () => {
  it("returns restore_not_found when fetchRestoreForCancel resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchRestoreForCancel = vi.fn(async () => null);

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "restore_not_found" });
    expect(deps.markRestoreCancelling).not.toHaveBeenCalled();
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
    expect(deps.markRestoreCancelled).not.toHaveBeenCalled();
  });

  it.each(["succeeded", "failed", "cancelled"])(
    "returns restore_already_terminal when restore.status is %s",
    async (status) => {
      const deps = makeDeps();
      deps.fetchRestoreForCancel = vi.fn(async () => ({
        id: RESTORE_ID,
        status,
        triggerRunIds: [TRIGGER_RUN_ID_A],
      }));

      const result = await processRestoreCancel(
        { restoreId: RESTORE_ID },
        { ...deps, now: () => NOW },
      );

      expect(result).toEqual({ ok: false, error: "restore_already_terminal" });
      expect(deps.markRestoreCancelling).not.toHaveBeenCalled();
      expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
      expect(deps.markRestoreCancelled).not.toHaveBeenCalled();
    },
  );

  it("returns restore_already_terminal when restore.status is already 'cancelling' (idempotent double-click)", async () => {
    const deps = makeDeps();
    deps.fetchRestoreForCancel = vi.fn(async () => ({
      id: RESTORE_ID,
      status: "cancelling",
      triggerRunIds: [TRIGGER_RUN_ID_A],
    }));

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "restore_already_terminal" });
  });

  it("returns restore_already_terminal when CAS to 'cancelling' loses the race", async () => {
    // Two concurrent cancel calls. The first wins; the second's
    // markRestoreCancelling UPDATE matches no rows (WHERE status IN
    // ('queued','running')) and returns false.
    const deps = makeDeps();
    deps.markRestoreCancelling = vi.fn(async () => false);

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "restore_already_terminal" });
    expect(deps.cancelTriggerRun).not.toHaveBeenCalled();
    expect(deps.markRestoreCancelled).not.toHaveBeenCalled();
  });
});

describe("processRestoreCancel — Trigger.dev failures", () => {
  it("swallows a single runs.cancel rejection and continues to the next id, then flips to cancelled", async () => {
    const deps = makeDeps();
    deps.cancelTriggerRun = vi.fn(async (id: string) => {
      if (id === TRIGGER_RUN_ID_A) {
        throw new Error("trigger_run_not_found");
      }
    });

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      cancelledTriggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    });
    expect(deps.cancelTriggerRun).toHaveBeenCalledTimes(2);
    expect(deps.markRestoreCancelled).toHaveBeenCalledWith({
      restoreId: RESTORE_ID,
      cancelledAt: NOW,
    });
  });

  it("flips to cancelled even when every runs.cancel rejects", async () => {
    const deps = makeDeps();
    deps.cancelTriggerRun = vi.fn(async () => {
      throw new Error("network");
    });

    const result = await processRestoreCancel(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      cancelledTriggerRunIds: [TRIGGER_RUN_ID_A, TRIGGER_RUN_ID_B],
    });
    expect(deps.markRestoreCancelled).toHaveBeenCalledOnce();
  });
});
