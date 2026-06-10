// Unit tests for the attachment downloader (openspec/changes/workflows-attachments).
//
// All deps are injected: a fake StorageWriter (records writeBlob calls), fake
// lookup/record engine callbacks, and a scripted fetch. Covers:
//   - dedup hit → no download, no writeBlob, returns existing key
//   - dedup miss → download + writeBlob + record, returns new key
//   - mixed hit/miss in one cell
//   - composite ID format (PRD §2.8)
//   - URL-refresh retry on a 403 from the CDN
//   - empty cell → no calls

import { describe, expect, it, vi } from "vitest";
import {
  compositeIdFor,
  createAttachmentDownloader,
  type AirtableAttachment,
  type AttachmentDownloaderDeps,
  type DownloadContext,
} from "../trigger/tasks/_lib/attachment-downloader";
import type { StorageWriter } from "../trigger/tasks/_lib/storage-writer";

const CTX: DownloadContext = {
  baseId: "appB",
  tableId: "tblT",
  recordId: "recR",
  fieldId: "fldF",
};

function fakeWriter(): {
  writer: StorageWriter;
  blobs: Array<{ key: string; size: number; contentType: string }>;
} {
  const blobs: Array<{ key: string; size: number; contentType: string }> = [];
  const writer: StorageWriter = {
    writeCsv: vi.fn(async () => ({ path: "", size: 0 })),
    writeBlob: vi.fn(async (key: string, body: Uint8Array, ct: string) => {
      blobs.push({ key, size: body.byteLength, contentType: ct });
      return { path: `fake://${key}`, size: body.byteLength };
    }),
    deletePrefix: vi.fn(async () => ({ deletedCount: 0 })),
  };
  return { writer, blobs };
}

function makeDeps(
  overrides: Partial<AttachmentDownloaderDeps> = {},
): {
  deps: AttachmentDownloaderDeps;
  blobs: Array<{ key: string; size: number; contentType: string }>;
  recorded: Array<{ spaceId: string; entries: unknown[] }>;
} {
  const { writer, blobs } = fakeWriter();
  const recorded: Array<{ spaceId: string; entries: unknown[] }> = [];
  const deps: AttachmentDownloaderDeps = {
    writer,
    spaceId: "space-1",
    buildKey: (compositeId, filename) => `space-1/att/${compositeId}/${filename}`,
    lookup: vi.fn(async () => ({})),
    record: vi.fn(async (spaceId, entries) => {
      recorded.push({ spaceId, entries });
    }),
    fetchImpl: vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200 }),
    ) as unknown as typeof fetch,
    ...overrides,
  };
  return { deps, blobs, recorded };
}

const ATT = (id: string): AirtableAttachment => ({
  id,
  url: `https://dl.airtable.com/${id}`,
  filename: `${id}.png`,
  type: "image/png",
  size: 5,
});

describe("compositeIdFor", () => {
  it("matches the PRD §2.8 format {base}_{table}_{record}_{field}_{attachment}", () => {
    expect(compositeIdFor(CTX, "attA")).toBe("appB_tblT_recR_fldF_attA");
  });
});

describe("attachment-downloader.processCell", () => {
  it("downloads a miss: writeBlob + record, returns the new key", async () => {
    const { deps, blobs, recorded } = makeDeps();
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell([ATT("attA")], CTX);

    const expectedKey = "space-1/att/appB_tblT_recR_fldF_attA/attA.png";
    expect(result.downloaded).toBe(1);
    expect(result.keys).toEqual([expectedKey]);
    expect(blobs).toEqual([
      { key: expectedKey, size: 5, contentType: "image/png" },
    ]);
    expect(recorded).toHaveLength(1);
    // Defaults to uploadStatus 'uploaded' when deps omit it, and stamps the
    // source filename.
    expect(recorded[0]!.entries).toEqual([
      {
        compositeId: "appB_tblT_recR_fldF_attA",
        storageKey: expectedKey,
        sizeBytes: 5,
        mimeType: "image/png",
        filename: "attA.png",
        uploadStatus: "uploaded",
      },
    ]);
  });

  it("records uploadStatus 'ready' when deps.uploadStatus is 'ready'", async () => {
    const { deps, recorded } = makeDeps({ uploadStatus: "ready" });
    const downloader = createAttachmentDownloader(deps);

    await downloader.processCell([ATT("attA")], CTX);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.entries).toEqual([
      {
        compositeId: "appB_tblT_recR_fldF_attA",
        storageKey: "space-1/att/appB_tblT_recR_fldF_attA/attA.png",
        sizeBytes: 5,
        mimeType: "image/png",
        filename: "attA.png",
        uploadStatus: "ready",
      },
    ]);
  });

  it("dedup hit: returns the existing key, no download, no record", async () => {
    const existingKey = "space-1/att/appB_tblT_recR_fldF_attA/old.png";
    const { deps, blobs, recorded } = makeDeps({
      lookup: vi.fn(async () => ({
        appB_tblT_recR_fldF_attA: {
          storageKey: existingKey,
          uploadStatus: "uploaded",
        },
      })),
    });
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell([ATT("attA")], CTX);

    expect(result.downloaded).toBe(0);
    expect(result.keys).toEqual([existingKey]);
    expect(blobs).toEqual([]);
    expect(recorded).toEqual([]);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("mixed hit + miss in one cell preserves order", async () => {
    const hitKey = "space-1/att/appB_tblT_recR_fldF_attHit/h.png";
    const { deps, blobs } = makeDeps({
      lookup: vi.fn(async () => ({
        appB_tblT_recR_fldF_attHit: {
          storageKey: hitKey,
          uploadStatus: "uploaded",
        },
      })),
    });
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell(
      [ATT("attHit"), ATT("attMiss")],
      CTX,
    );

    expect(result.downloaded).toBe(1);
    expect(result.keys).toEqual([
      hitKey,
      "space-1/att/appB_tblT_recR_fldF_attMiss/attMiss.png",
    ]);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.key).toBe(
      "space-1/att/appB_tblT_recR_fldF_attMiss/attMiss.png",
    );
  });

  it("retries once on a 403 from the CDN using refreshUrl", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      call += 1;
      const url = typeof input === "string" ? input : input.toString();
      if (call === 1) return new Response("expired", { status: 403 });
      // second call must be the refreshed URL
      expect(url).toBe("https://dl.airtable.com/fresh");
      return new Response(new Uint8Array([9, 9]), { status: 200 });
    }) as unknown as typeof fetch;
    const refreshUrl = vi.fn(async () => "https://dl.airtable.com/fresh");
    const { deps, blobs } = makeDeps({ fetchImpl, refreshUrl });
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell([ATT("attA")], CTX);

    expect(refreshUrl).toHaveBeenCalledTimes(1);
    expect(result.downloaded).toBe(1);
    expect(blobs[0]!.size).toBe(2);
  });

  it("empty cell → no lookup, no download, empty keys", async () => {
    const { deps } = makeDeps();
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell([], CTX);

    expect(result).toEqual({ keys: [], downloaded: 0 });
    expect(deps.lookup).not.toHaveBeenCalled();
  });
});
