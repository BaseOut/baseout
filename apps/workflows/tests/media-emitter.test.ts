// Unit tests for the media-metadata batch emitter (workflows-media-metadata
// task 1.2, design Decisions 2/3): record-boundary batching, `complete`
// semantics, distinct-asset/ref counting, and the never-throw failure
// isolation contract.

import { describe, expect, it, vi } from "vitest";
import {
  createMediaEmitter,
  type MediaAttachmentEntryWire,
  type MediaRecordCaptureWire,
} from "../trigger/tasks/_lib/media-emitter";

const entry = (
  attachmentId: string,
  checksum = `sha256:${attachmentId}`,
): MediaAttachmentEntryWire => ({
  attachmentId,
  fieldId: "fldF",
  filename: `${attachmentId}.png`,
  checksum,
  contentType: "image/png",
  sizeBytes: 5,
  storage: { kind: "r2_managed", key: `att/${attachmentId}` },
});

function makeSync(failOnCall?: number[]) {
  const batches: MediaRecordCaptureWire[][] = [];
  let call = 0;
  const syncMedia = vi.fn(async (records: MediaRecordCaptureWire[]) => {
    call += 1;
    if (failOnCall?.includes(call)) throw new Error(`media-sync 503`);
    batches.push(records);
  });
  return { syncMedia, batches };
}

describe("media emitter — batching + counts", () => {
  it("accumulates per record, flushes on finish, reports captured counts", async () => {
    const { syncMedia, batches } = makeSync();
    const em = createMediaEmitter({ syncMedia });

    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attA"));
    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attB"));
    await em.recordDone("rec1");
    em.attachment({ recordId: "rec2", tableId: "tbl1" }, entry("attC"));
    await em.recordDone("rec2");
    const outcome = await em.finish();

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([
      {
        recordId: "rec1",
        tableId: "tbl1",
        complete: true,
        attachments: [entry("attA"), entry("attB")],
      },
      { recordId: "rec2", tableId: "tbl1", complete: true, attachments: [entry("attC")] },
    ]);
    expect(outcome).toEqual({ status: "captured", records: 2, assets: 3, refs: 3 });
  });

  it("counts one asset per distinct checksum across records (dedup-skip refs accrue)", async () => {
    const { syncMedia } = makeSync();
    const em = createMediaEmitter({ syncMedia });

    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attA", "sha256:same"));
    await em.recordDone("rec1");
    em.attachment({ recordId: "rec2", tableId: "tbl1" }, entry("attB", "sha256:same"));
    await em.recordDone("rec2");
    const outcome = await em.finish();

    expect(outcome).toEqual({ status: "captured", records: 2, assets: 1, refs: 2 });
  });

  it("flushes when the record threshold fills, remainder on finish", async () => {
    const { syncMedia, batches } = makeSync();
    const em = createMediaEmitter({ syncMedia, maxBatchRecords: 2 });

    for (const rec of ["rec1", "rec2", "rec3"]) {
      em.attachment({ recordId: rec, tableId: "tbl1" }, entry(`att-${rec}`));
      await em.recordDone(rec);
    }
    const outcome = await em.finish();

    expect(batches).toHaveLength(2);
    expect(batches[0]!.map((r) => r.recordId)).toEqual(["rec1", "rec2"]);
    expect(batches[1]!.map((r) => r.recordId)).toEqual(["rec3"]);
    expect(outcome).toEqual({ status: "captured", records: 3, assets: 3, refs: 3 });
  });

  it("flushes when the attachment threshold fills (whichever first)", async () => {
    const { syncMedia, batches } = makeSync();
    const em = createMediaEmitter({ syncMedia, maxBatchAttachments: 3 });

    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attA"));
    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attB"));
    await em.recordDone("rec1"); // 2 attachments — below threshold
    em.attachment({ recordId: "rec2", tableId: "tbl1" }, entry("attC"));
    await em.recordDone("rec2"); // 3 attachments — flush fires
    em.attachment({ recordId: "rec3", tableId: "tbl1" }, entry("attD"));
    await em.recordDone("rec3");
    await em.finish();

    expect(batches).toHaveLength(2);
    expect(batches[0]!.map((r) => r.recordId)).toEqual(["rec1", "rec2"]);
    expect(batches[1]!.map((r) => r.recordId)).toEqual(["rec3"]);
  });

  it("records without attachment entries are never emitted", async () => {
    const { syncMedia, batches } = makeSync();
    const em = createMediaEmitter({ syncMedia });

    await em.recordDone("rec-empty");
    const outcome = await em.finish();

    expect(batches).toHaveLength(0);
    expect(syncMedia).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: "captured", records: 0, assets: 0, refs: 0 });
  });
});

describe("media emitter — failure isolation", () => {
  it("first flush fails with nothing delivered → skipped(reason), delivery stops", async () => {
    const { syncMedia } = makeSync([1]);
    const em = createMediaEmitter({ syncMedia, maxBatchRecords: 1 });

    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attA"));
    await em.recordDone("rec1"); // flush 1 → fails
    em.attachment({ recordId: "rec2", tableId: "tbl1" }, entry("attB"));
    await em.recordDone("rec2"); // dropped — no further POSTs
    const outcome = await em.finish();

    expect(syncMedia).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ status: "skipped", reason: "media-sync 503" });
  });

  it("failure after a delivered batch → partial with delivered-only counts", async () => {
    const { syncMedia, batches } = makeSync([2]);
    const em = createMediaEmitter({ syncMedia, maxBatchRecords: 1 });

    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attA"));
    await em.recordDone("rec1"); // flush 1 → ok
    em.attachment({ recordId: "rec2", tableId: "tbl1" }, entry("attB"));
    await em.recordDone("rec2"); // flush 2 → fails
    em.attachment({ recordId: "rec3", tableId: "tbl1" }, entry("attC"));
    await em.recordDone("rec3"); // dropped
    const outcome = await em.finish();

    expect(batches).toHaveLength(1);
    expect(syncMedia).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({
      status: "partial",
      reason: "media-sync 503",
      records: 1,
      assets: 1,
      refs: 1,
    });
  });

  it("every delivered record capture carries complete: true", async () => {
    const { syncMedia, batches } = makeSync();
    const em = createMediaEmitter({ syncMedia, maxBatchRecords: 1 });

    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attA"));
    await em.recordDone("rec1");
    await em.finish();

    for (const batch of batches) {
      for (const rec of batch) expect(rec.complete).toBe(true);
    }
  });

  it("finish never throws even when the final flush fails", async () => {
    const { syncMedia } = makeSync([1]);
    const em = createMediaEmitter({ syncMedia });

    em.attachment({ recordId: "rec1", tableId: "tbl1" }, entry("attA"));
    await em.recordDone("rec1");
    const outcome = await em.finish();

    expect(outcome).toEqual({ status: "skipped", reason: "media-sync 503" });
  });
});
