// Tests for the cleanup-expired-snapshots pure orchestration module
// (openspec/changes/workflows-retention-and-cleanup).
//
// runCleanupSweep(deps):
//   - fetches the delete plan from the engine (deps.fetchPlan),
//   - for each planned run, resolves a StorageWriter and deletePrefix's every
//     prefix (continuing past per-prefix failures),
//   - reports per-run ok/fail back to the engine (deps.postComplete) so the
//     engine soft-deletes the confirmed rows.
//
// The actual HTTP + StorageWriter factory live in the task wrapper; this module
// is pure and dep-injected so it tests in plain Node without R2 creds.

import { describe, expect, it, vi } from "vitest";
import type { StorageWriter } from "../trigger/tasks/_lib/storage-writer";
import {
  runCleanupSweep,
  type CleanupPlan,
} from "../trigger/tasks/cleanup-expired-snapshots";

function makeWriter(
  perPrefix: (prefix: string) => Promise<{ deletedCount: number }>,
): StorageWriter {
  return {
    writeCsv: vi.fn(async () => ({ path: "", size: 0 })),
    writeBlob: vi.fn(async () => ({ path: "", size: 0 })),
    deletePrefix: vi.fn(perPrefix),
  };
}

const run = (runId: string, prefixes: string[]) => ({
  runId,
  spaceId: `space-of-${runId}`,
  storageType: "r2_managed",
  prefixes,
});

describe("runCleanupSweep", () => {
  it("deletes every prefix of every planned run and reports all ok", async () => {
    const plan: CleanupPlan = {
      runs: [run("r1", ["A/", "B/"]), run("r2", ["C/"])],
    };
    const writer = makeWriter(async () => ({ deletedCount: 1 }));
    const postComplete = vi.fn(async () => ({ updated: 2 }));

    const result = await runCleanupSweep({
      fetchPlan: async () => plan,
      resolveWriter: () => writer,
      postComplete,
    });

    expect(writer.deletePrefix).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ planned: 2, deleted: 2, failed: 0 });
    expect(postComplete).toHaveBeenCalledWith([
      { runId: "r1", ok: true },
      { runId: "r2", ok: true },
    ]);
  });

  it("marks a run failed (ok:false) when one of its prefixes throws, but continues", async () => {
    const plan: CleanupPlan = {
      runs: [run("good", ["A/"]), run("bad", ["B/", "C/"])],
    };
    const writer = makeWriter(async (p) => {
      if (p === "B/") throw new Error("api_500");
      return { deletedCount: 1 };
    });
    const postComplete = vi.fn(async () => ({ updated: 1 }));

    const result = await runCleanupSweep({
      fetchPlan: async () => plan,
      resolveWriter: () => writer,
      postComplete,
    });

    // Continues past the failure — "bad" still attempts C/.
    expect(writer.deletePrefix).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ planned: 2, deleted: 1, failed: 1 });
    expect(postComplete).toHaveBeenCalledWith([
      { runId: "good", ok: true },
      { runId: "bad", ok: false },
    ]);
  });

  it("treats an empty-prefix run as ok (metadata-only prune)", async () => {
    const plan: CleanupPlan = { runs: [run("meta", [])] };
    const writer = makeWriter(async () => ({ deletedCount: 1 }));
    const postComplete = vi.fn(async () => ({ updated: 1 }));

    const result = await runCleanupSweep({
      fetchPlan: async () => plan,
      resolveWriter: () => writer,
      postComplete,
    });

    expect(writer.deletePrefix).not.toHaveBeenCalled();
    expect(result).toEqual({ planned: 1, deleted: 1, failed: 0 });
    expect(postComplete).toHaveBeenCalledWith([{ runId: "meta", ok: true }]);
  });

  it("does not call postComplete when the plan is empty", async () => {
    const postComplete = vi.fn(async () => ({ updated: 0 }));
    const result = await runCleanupSweep({
      fetchPlan: async () => ({ runs: [] }),
      resolveWriter: () => makeWriter(async () => ({ deletedCount: 0 })),
      postComplete,
    });

    expect(result).toEqual({ planned: 0, deleted: 0, failed: 0 });
    expect(postComplete).not.toHaveBeenCalled();
  });

  it("resolves a writer per run's storageType", async () => {
    const plan: CleanupPlan = {
      runs: [
        { runId: "r1", spaceId: "s1", storageType: "r2_managed", prefixes: ["A/"] },
        { runId: "r2", spaceId: "s2", storageType: "google_drive", prefixes: ["B/"] },
      ],
    };
    const writer = makeWriter(async () => ({ deletedCount: 1 }));
    const resolveWriter = vi.fn(() => writer);

    await runCleanupSweep({
      fetchPlan: async () => plan,
      resolveWriter,
      postComplete: vi.fn(async () => ({ updated: 2 })),
    });

    expect(resolveWriter).toHaveBeenCalledWith("r2_managed");
    expect(resolveWriter).toHaveBeenCalledWith("google_drive");
  });
});
