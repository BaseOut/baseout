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
        tableId: "tblT",
        fieldId: "fldF",
        recordId: "recR",
        storageKey: expectedKey,
        sizeBytes: 5,
        mimeType: "image/png",
        // workflows-media-metadata: writes hash their bytes and stamp the
        // dedup row so future lookups can return the stored hash.
        contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
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
        tableId: "tblT",
        fieldId: "fldF",
        recordId: "recR",
        storageKey: "space-1/att/appB_tblT_recR_fldF_attA/attA.png",
        sizeBytes: 5,
        mimeType: "image/png",
        contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
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

    expect(result).toEqual({ keys: [], downloaded: 0, attachments: [] });
    expect(deps.lookup).not.toHaveBeenCalled();
  });
});

// workflows-media-metadata task 1.1 — the export-path tap. processCell now
// surfaces per-attachment metadata for writes AND dedup-skips so the backup
// task can emit it to media-sync without re-deriving anything.
describe("attachment-downloader.processCell — media metadata tap", () => {
  async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  it("a write emits metadata with the sha256 of the downloaded bytes", async () => {
    const { deps, recorded } = makeDeps();
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell([ATT("attA")], CTX);

    const expectedChecksum = `sha256:${await sha256Hex(new Uint8Array([1, 2, 3, 4, 5]))}`;
    expect(result.attachments).toEqual([
      {
        attachmentId: "attA",
        filename: "attA.png",
        storageKey: "space-1/att/appB_tblT_recR_fldF_attA/attA.png",
        checksum: expectedChecksum,
        contentType: "image/png",
        sizeBytes: 5,
        dedupSkipped: false,
      },
    ]);
    // The same hash lands on the dedup record entry (engine persists it).
    expect(
      (recorded[0]!.entries[0] as { contentHash?: string }).contentHash,
    ).toBe(expectedChecksum);
  });

  it("a dedup-skip emits metadata with the engine-stored hash when the lookup returns one", async () => {
    const existingKey = "space-1/att/appB_tblT_recR_fldF_attA/old.png";
    const { deps } = makeDeps({
      lookup: vi.fn(async () => ({
        appB_tblT_recR_fldF_attA: {
          storageKey: existingKey,
          uploadStatus: "uploaded",
          contentHash: "sha256:feedbead",
        },
      })),
    });
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell([ATT("attA")], CTX);

    expect(result.attachments).toEqual([
      {
        attachmentId: "attA",
        filename: "attA.png",
        storageKey: existingKey,
        checksum: "sha256:feedbead",
        contentType: "image/png",
        sizeBytes: 5,
        dedupSkipped: true,
      },
    ]);
  });

  it("a dedup-skip without a stored hash falls back to the att:<id> surrogate", async () => {
    const existingKey = "space-1/att/appB_tblT_recR_fldF_attA/old.png";
    const { deps } = makeDeps({
      lookup: vi.fn(async () => ({
        appB_tblT_recR_fldF_attA: {
          storageKey: existingKey,
          uploadStatus: "uploaded",
        },
      })),
    });
    const downloader = createAttachmentDownloader(deps);

    const result = await downloader.processCell([ATT("attA")], CTX);

    expect(result.attachments![0]!.checksum).toBe("att:attA");
    expect(result.attachments![0]!.dedupSkipped).toBe(true);
  });

  it("mixed hit + miss keeps metadata in field order", async () => {
    const hitKey = "space-1/att/appB_tblT_recR_fldF_attHit/h.png";
    const { deps } = makeDeps({
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

    expect(result.attachments!.map((a) => [a.attachmentId, a.dedupSkipped])).toEqual([
      ["attHit", true],
      ["attMiss", false],
    ]);
    expect(result.attachments![1]!.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
