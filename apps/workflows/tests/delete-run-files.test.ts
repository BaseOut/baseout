// Tests for the delete-run-files pure orchestration module (Phase C.5 of
// openspec/changes/shared-backup-run-delete).
//
// runDeleteRunFiles(payload, deps):
//   - Iterates payload.prefixes, calls deps.writer.deletePrefix on each.
//   - Accumulates per-prefix results (deletedCount on success, error on
//     failure).
//   - POSTs the accumulated result to /delete-complete via the injected
//     postDeleteComplete callback.
//   - ok = every prefix succeeded.

import { describe, expect, it, vi } from "vitest";
import type { StorageWriter } from "../trigger/tasks/_lib/storage-writer";
import { runDeleteRunFiles } from "../trigger/tasks/delete-run-files";

const RUN_ID = "run-1";

function makeWriter(
  perPrefix: (prefix: string) => Promise<{ deletedCount: number }>,
): StorageWriter {
  return {
    writeCsv: vi.fn(async () => ({ path: "", size: 0 })),
    writeBlob: vi.fn(async () => ({ path: "", size: 0 })),
    deletePrefix: vi.fn(perPrefix),
  };
}

describe("runDeleteRunFiles", () => {
  it("all prefixes succeed → callback with ok:true + per-prefix deletedCount", async () => {
    const writer = makeWriter(async () => ({ deletedCount: 1 }));
    const postDeleteComplete = vi.fn(async () => undefined);

    const result = await runDeleteRunFiles(
      { runId: RUN_ID, storageType: "r2_managed", prefixes: ["A/", "B/"] },
      { writer, postDeleteComplete },
    );

    expect(result.ok).toBe(true);
    expect(writer.deletePrefix).toHaveBeenCalledTimes(2);
    expect(writer.deletePrefix).toHaveBeenNthCalledWith(1, "A/");
    expect(writer.deletePrefix).toHaveBeenNthCalledWith(2, "B/");
    expect(postDeleteComplete).toHaveBeenCalledWith({
      runId: RUN_ID,
      ok: true,
      results: [
        { prefix: "A/", deletedCount: 1 },
        { prefix: "B/", deletedCount: 1 },
      ],
    });
  });

  it("one prefix throws → callback with ok:false + the failure recorded", async () => {
    const writer = makeWriter(async (p) => {
      if (p === "B/") throw new Error("api_500");
      return { deletedCount: 1 };
    });
    const postDeleteComplete = vi.fn(async () => undefined);

    const result = await runDeleteRunFiles(
      { runId: RUN_ID, storageType: "r2_managed", prefixes: ["A/", "B/", "C/"] },
      { writer, postDeleteComplete },
    );

    expect(result.ok).toBe(false);
    // Continues past the failure — A and C are processed.
    expect(writer.deletePrefix).toHaveBeenCalledTimes(3);
    expect(postDeleteComplete).toHaveBeenCalledWith({
      runId: RUN_ID,
      ok: false,
      results: [
        { prefix: "A/", deletedCount: 1 },
        { prefix: "B/", error: "api_500" },
        { prefix: "C/", deletedCount: 1 },
      ],
    });
  });

  it("empty prefixes → callback with ok:true + empty results (metadata-only delete)", async () => {
    const writer = makeWriter(async () => ({ deletedCount: 1 }));
    const postDeleteComplete = vi.fn(async () => undefined);

    const result = await runDeleteRunFiles(
      { runId: RUN_ID, storageType: "r2_managed", prefixes: [] },
      { writer, postDeleteComplete },
    );

    expect(result.ok).toBe(true);
    expect(writer.deletePrefix).not.toHaveBeenCalled();
    expect(postDeleteComplete).toHaveBeenCalledWith({
      runId: RUN_ID,
      ok: true,
      results: [],
    });
  });

  it("error.message is captured (non-Error throw stringified)", async () => {
    const writer = makeWriter(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "raw-string-throw";
    });
    const postDeleteComplete = vi.fn(async () => undefined);

    await runDeleteRunFiles(
      { runId: RUN_ID, storageType: "r2_managed", prefixes: ["X/"] },
      { writer, postDeleteComplete },
    );

    expect(postDeleteComplete).toHaveBeenCalledWith({
      runId: RUN_ID,
      ok: false,
      results: [{ prefix: "X/", error: "raw-string-throw" }],
    });
  });
});
