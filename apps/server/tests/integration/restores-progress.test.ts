// Pure-function tests for the restore-progress orchestration (server-restore Phase C.1).
//
// Mirrors apps/server/tests/integration/runs-progress.test.ts exactly.
// Routing-layer tests (401, 405, 400, etc.) would live in
// restores-progress-route.test.ts.
//
// Design (mirrors the backup progress design):
//   - `applyProgress` is a single dep. The route wires it to a CTE-shaped
//     SQL UPDATE that distinguishes three outcomes via RETURNING:
//       (a) no row by that id     → exists=false, updated=false → 404 restore_not_found
//       (b) row exists, terminal  → exists=true,  updated=false → 200 noop
//       (c) row exists, running   → exists=true,  updated=true  → 200 applied
//   - triggerRunId + atBaseId are accepted for tracing only; NOT forwarded to dep.
//   - /complete is the authoritative writer; /progress bumps are advisory.

import { describe, expect, it, vi } from "vitest";
import { processRestoreProgress } from "../../src/lib/restores/progress";

const RESTORE_ID = "22222222-2222-2222-2222-222222222222";
const TRIGGER_RUN_ID = "run_aaaaaaaaaaaaaaaaaaaaaaaa";
const AT_BASE_ID = "appAAA111";

describe("processRestoreProgress", () => {
  it("returns applied when the row exists and is running", async () => {
    const applyProgress = vi.fn(async () => ({
      exists: true,
      updated: true,
    }));

    const result = await processRestoreProgress(
      {
        restoreId: RESTORE_ID,
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
      restoreId: RESTORE_ID,
      recordsAppended: 100,
      tableCompleted: false,
    });
  });

  it("returns restore_not_found when the row does not exist", async () => {
    const applyProgress = vi.fn(async () => ({
      exists: false,
      updated: false,
    }));

    const result = await processRestoreProgress(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID,
        atBaseId: AT_BASE_ID,
        recordsAppended: 50,
        tableCompleted: true,
      },
      { applyProgress },
    );

    expect(result).toEqual({ ok: false, error: "restore_not_found" });
  });

  it("returns noop when the row exists but is already terminal", async () => {
    // A stray /progress arriving after /complete already flipped status to
    // 'succeeded' / 'failed' — the WHERE status='running' guard in the SQL
    // UPDATE matches no rows, so updated=false. Silent noop so the runner's
    // fire-and-forget POST doesn't retry.
    const applyProgress = vi.fn(async () => ({
      exists: true,
      updated: false,
    }));

    const result = await processRestoreProgress(
      {
        restoreId: RESTORE_ID,
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

    await processRestoreProgress(
      {
        restoreId: RESTORE_ID,
        triggerRunId: TRIGGER_RUN_ID,
        atBaseId: AT_BASE_ID,
        recordsAppended: 0,
        tableCompleted: true,
      },
      { applyProgress },
    );

    expect(applyProgress).toHaveBeenCalledWith({
      restoreId: RESTORE_ID,
      recordsAppended: 0,
      tableCompleted: true,
    });
  });

  it("does not pass triggerRunId or atBaseId to applyProgress (advisory only)", async () => {
    // The pure function accepts triggerRunId + atBaseId for tracing/logging
    // but the SQL doesn't gate on them — counter bumps are advisory,
    // /complete is the authoritative writer.
    const applyProgress = vi.fn(async () => ({
      exists: true,
      updated: true,
    }));

    await processRestoreProgress(
      {
        restoreId: RESTORE_ID,
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
