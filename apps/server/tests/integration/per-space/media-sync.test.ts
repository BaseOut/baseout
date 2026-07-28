// Pure-module tests for the media index ingest (server-media-index): content
// classing (write-time column, extension fallback), batch extraction leniency,
// and the asset/ref diff (dedup by checksum; per-record `complete` deletion
// rule mirrored from comments-sync).

import { describe, it, expect } from "vitest";
import {
  classifyContentType,
  diffMediaBatch,
  extractMediaBatch,
  type PriorAssetRef,
} from "../../../src/lib/per-space/media-sync";

const att = (id: string, over: Record<string, unknown> = {}) => ({
  attachmentId: id,
  fieldId: "fldA",
  filename: `${id}.png`,
  checksum: `sum-${id}`,
  contentType: "image/png",
  sizeBytes: 1024,
  storage: { kind: "r2_managed", key: `attachments/${id}` },
  ...over,
});

describe("classifyContentType", () => {
  it("classes by mime prefix, document set, extension fallback, then other", () => {
    expect(classifyContentType("image/png", null)).toBe("image");
    expect(classifyContentType("video/mp4", null)).toBe("video");
    expect(classifyContentType("audio/mpeg", null)).toBe("audio");
    expect(classifyContentType("application/pdf", null)).toBe("document");
    expect(classifyContentType(null, "scan.HEIC")).toBe("image"); // extension fallback, case-insensitive
    expect(classifyContentType(null, "notes.docx")).toBe("document");
    expect(classifyContentType("application/octet-stream", "blob.bin")).toBe("other");
    expect(classifyContentType(null, null)).toBe("other");
  });
});

describe("extractMediaBatch", () => {
  it("extracts attachments with storage discrimination; malformed entries dropped + counted", () => {
    const batch = extractMediaBatch([
      {
        recordId: "recA",
        tableId: "tblA",
        complete: true,
        attachments: [
          att("att1"),
          att("att2", { storage: { kind: "destination", provider: "google_drive", locator: "drive://folder/file" }, contentType: null, filename: "video.mov" }),
          { attachmentId: "attBad" }, // no checksum/fieldId — dropped
          "junk",
        ],
      },
      { recordId: 5, attachments: [] }, // bad record — dropped
    ]);
    expect(batch.dropped).toBe(3);
    expect(batch.records).toHaveLength(1);
    const [a1, a2] = batch.records[0]!.attachments;
    expect(a1).toMatchObject({
      attachmentId: "att1",
      checksum: "sum-att1",
      contentClass: "image",
      storageKind: "r2_managed",
      storageProvider: null,
      storageRef: "attachments/att1",
    });
    expect(a2).toMatchObject({
      attachmentId: "att2",
      contentClass: "video", // extension fallback (no mime)
      storageKind: "destination",
      storageProvider: "google_drive",
      storageRef: "drive://folder/file",
    });
  });
});

describe("diffMediaBatch", () => {
  const priorRef = (over: Partial<PriorAssetRef> & { attachmentId: string }): PriorAssetRef => ({
    recordId: "recA",
    status: "active",
    ...over,
  });

  it("dedups assets by checksum across records — one asset, N refs", () => {
    const batch = extractMediaBatch([
      { recordId: "recA", tableId: "tblA", complete: true, attachments: [att("att1", { checksum: "same" })] },
      { recordId: "recB", tableId: "tblA", complete: true, attachments: [att("att2", { checksum: "same", filename: "renamed.png" })] },
    ]);
    const d = diffMediaBatch({ baseId: "appX", batch, prior: [] });
    expect(d.assetUpserts).toHaveLength(1);
    expect(d.assetUpserts[0]!.checksum).toBe("same");
    expect(d.refUpserts).toHaveLength(2);
    expect(d.refUpserts.map((r) => r.filename)).toEqual(["att1.png", "renamed.png"]);
    expect(d.addedRefs).toBe(2);
  });

  it("removes refs absent from a complete capture; incomplete never removes; other records untouched", () => {
    const prior = [
      priorRef({ attachmentId: "att1" }),
      priorRef({ attachmentId: "attGone" }),
      priorRef({ attachmentId: "attOther", recordId: "recOther" }),
    ];
    const complete = diffMediaBatch({
      baseId: "appX",
      batch: extractMediaBatch([
        { recordId: "recA", tableId: "tblA", complete: true, attachments: [att("att1")] },
      ]),
      prior,
    });
    expect(complete.refRemovals).toEqual(["attGone"]);

    const incomplete = diffMediaBatch({
      baseId: "appX",
      batch: extractMediaBatch([
        { recordId: "recA", tableId: "tblA", attachments: [att("att1")] },
      ]),
      prior,
    });
    expect(incomplete.refRemovals).toEqual([]);
  });

  it("already-removed refs are not re-removed; re-captured removed refs upsert (resurrect)", () => {
    const prior = [priorRef({ attachmentId: "att1", status: "removed" })];
    const d = diffMediaBatch({
      baseId: "appX",
      batch: extractMediaBatch([
        { recordId: "recA", tableId: "tblA", complete: true, attachments: [att("att1")] },
      ]),
      prior,
    });
    expect(d.refRemovals).toEqual([]);
    expect(d.refUpserts).toHaveLength(1);
    expect(d.addedRefs).toBe(0); // known id — not "added"
  });

  it("empty complete capture removes all of the record's active refs (attachment field cleared)", () => {
    const d = diffMediaBatch({
      baseId: "appX",
      batch: extractMediaBatch([{ recordId: "recA", tableId: "tblA", complete: true, attachments: [] }]),
      prior: [priorRef({ attachmentId: "att1" }), priorRef({ attachmentId: "att2" })],
    });
    expect(d.refRemovals.sort()).toEqual(["att1", "att2"]);
    expect(d.assetUpserts).toEqual([]);
  });
});
