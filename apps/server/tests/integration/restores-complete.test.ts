// Pure-function tests for the restore-complete orchestration (server-restore Phase C.3).
//
// Mirrors apps/server/tests/integration/runs-complete.test.ts, adapted for the
// restore lifecycle: only 'succeeded' | 'failed' statuses (no trial states),
// column names tables_restored / records_restored / attachments_restored, and
// a text[] trigger_run_ids (vs jsonb in backup_runs).
//
// Routing tests (401, 405, 400) would live in restores-complete-route.test.ts.
//
// Idempotency design (mirrors Option J):
//   - applyPerBaseCompletion atomically removes triggerRunId from
//     trigger_run_ids if present and increments per-restore counters.
//   - If triggerRunId is NOT in the array → returns null → caller treats
//     as a 200-noop replay.
//   - Otherwise returns { remainingCount, hasFailure } reflecting post-update state.
//   - When remainingCount === 0, processRestoreComplete computes the final
//     status (hasFailure → 'failed'; else → 'succeeded') and calls finalizeRestore.

import { describe, expect, it, vi } from "vitest";
import { processRestoreComplete } from "../../src/lib/restores/complete";

const RESTORE_ID = "22222222-2222-2222-2222-222222222222";
const TRIGGER_RUN_ID_A = "run_aaaaaaaaaaaaaaaaaaaaaaaa";
const TRIGGER_RUN_ID_B = "run_bbbbbbbbbbbbbbbbbbbbbbbb";
const AT_BASE_ID = "appAAA111";
const NOW = new Date("2026-06-26T12:00:00.000Z");

interface DepsBag {
  fetchRestoreById: ReturnType<typeof vi.fn>;
  applyPerBaseCompletion: ReturnType<typeof vi.fn>;
  finalizeRestore: ReturnType<typeof vi.fn>;
}

function makeDeps(): DepsBag {
  return {
    fetchRestoreById: vi.fn(async () => ({ id: RESTORE_ID })),
    applyPerBaseCompletion: vi.fn(async () => ({
      remainingCount: 0,
      hasFailure: false,
    })),
    finalizeRestore: vi.fn(async () => {}),
  };
}

describe("processRestoreComplete — happy path", () => {
  it("finalizes the restore as 'succeeded' when last completion lands and no prior failure", async () => {
    const deps = makeDeps();

    const result = await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesRestored: 3,
        recordsRestored: 42,
        attachmentsRestored: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "finalized", finalStatus: "succeeded" });
    expect(deps.finalizeRestore).toHaveBeenCalledTimes(1);
    expect(deps.finalizeRestore).toHaveBeenCalledWith({
      restoreId: RESTORE_ID,
      finalStatus: "succeeded",
      completedAt: NOW,
    });
  });

  it("forwards counts + null failureMessage to applyPerBaseCompletion on success", async () => {
    const deps = makeDeps();

    await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesRestored: 3,
        recordsRestored: 42,
        attachmentsRestored: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(deps.applyPerBaseCompletion).toHaveBeenCalledWith({
      restoreId: RESTORE_ID,
      triggerRunId: TRIGGER_RUN_ID_A,
      tablesRestored: 3,
      recordsRestored: 42,
      attachmentsRestored: 0,
      failureMessage: null,
    });
  });

  it("returns 'partial' (no finalize) when other bases are still outstanding", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 1,
      hasFailure: false,
    }));

    const result = await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesRestored: 3,
        recordsRestored: 42,
        attachmentsRestored: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "partial", remainingCount: 1 });
    expect(deps.finalizeRestore).not.toHaveBeenCalled();
  });
});

describe("processRestoreComplete — idempotent replay", () => {
  it("returns 'noop' when applyPerBaseCompletion resolves to null (triggerRunId already processed)", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => null);

    const result = await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesRestored: 3,
        recordsRestored: 42,
        attachmentsRestored: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "noop" });
    expect(deps.finalizeRestore).not.toHaveBeenCalled();
  });
});

describe("processRestoreComplete — failure semantics", () => {
  it("passes failureMessage = body.errorMessage when status='failed'", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 1,
      hasFailure: true,
    }));

    await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "failed",
        tablesRestored: 0,
        recordsRestored: 0,
        attachmentsRestored: 0,
        errorMessage: "table_not_found",
      },
      { ...deps, now: () => NOW },
    );

    expect(deps.applyPerBaseCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ failureMessage: "table_not_found" }),
    );
  });

  it("substitutes 'unknown_failure' when status='failed' but errorMessage is omitted", async () => {
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 0,
      hasFailure: true,
    }));

    await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "failed",
        tablesRestored: 0,
        recordsRestored: 0,
        attachmentsRestored: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(deps.applyPerBaseCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ failureMessage: "unknown_failure" }),
    );
  });

  it("finalizes as 'failed' when hasFailure=true regardless of this body's status", async () => {
    // Sticky: if a prior callback already recorded a failure, the LAST callback
    // (which might itself report 'succeeded') still flips the restore to failed.
    const deps = makeDeps();
    deps.applyPerBaseCompletion = vi.fn(async () => ({
      remainingCount: 0,
      hasFailure: true,
    }));

    const result = await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_B,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesRestored: 5,
        recordsRestored: 100,
        attachmentsRestored: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: true, kind: "finalized", finalStatus: "failed" });
    expect(deps.finalizeRestore).toHaveBeenCalledWith({
      restoreId: RESTORE_ID,
      finalStatus: "failed",
      completedAt: NOW,
    });
  });
});

describe("processRestoreComplete — validation failures", () => {
  it("returns restore_not_found when fetchRestoreById resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchRestoreById = vi.fn(async () => null);

    const result = await processRestoreComplete(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID_A,
        atBaseId: AT_BASE_ID,
        status: "succeeded",
        tablesRestored: 3,
        recordsRestored: 42,
        attachmentsRestored: 0,
      },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "restore_not_found" });
    expect(deps.applyPerBaseCompletion).not.toHaveBeenCalled();
    expect(deps.finalizeRestore).not.toHaveBeenCalled();
  });
});
