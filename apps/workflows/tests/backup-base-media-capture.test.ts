// Tests for the media-metadata emission step in runBackupBase
// (workflows-media-metadata tasks 1.1/1.2). Mirrors the harness in
// backup-base-comment-capture.test.ts; the batcher internals are pinned by
// tests/media-emitter.test.ts, the downloader tap by
// tests/attachment-downloader.test.ts — this matrix pins the wiring:
//   - emission follows attachment export (no payload flag): downloader wired
//     + syncMedia wired = emit; either absent = nothing,
//   - dedup-skipped attachments still emit refs (existing checksum),
//   - storage locator mapping per storageType (r2_managed / BYOS / local_fs),
//   - per-record complete captures with fieldId from the schema,
//   - a media-sync outage NEVER touches the run outcome, the attachment
//     export, or the other captures.

import { describe, expect, it, vi, type Mock } from "vitest";
import { runBackupBase, type BackupBaseDeps } from "../trigger/tasks/backup-base";
import type {
  AirtableAttachment,
  AttachmentDownloader,
  ProcessCellResult,
} from "../trigger/tasks/_lib/attachment-downloader";
import type { MediaRecordCaptureWire } from "../trigger/tasks/_lib/media-emitter";
import type {
  AirtableSchema,
  AirtableRecordsPage,
} from "../trigger/tasks/_lib/airtable-client";

const ENGINE = "https://engine.example.com";
const TOKEN = "internal-token";

function makeFetchMock(): typeof fetch {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/lock")) return new Response("{}", { status: 200 });
    if (url.endsWith("/unlock")) return new Response("{}", { status: 200 });
    if (url.endsWith("/token")) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(JSON.stringify({ accessToken: `pt-${body.encryptedToken}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 500 });
  }) as unknown as typeof fetch;
}

const SCHEMA: AirtableSchema = {
  tables: [
    {
      id: "tbl1",
      name: "Tasks",
      primaryFieldId: "f1",
      fields: [
        { id: "f1", name: "Name", type: "singleLineText" },
        { id: "fldFiles", name: "Files", type: "multipleAttachments" },
      ],
      views: [],
    },
  ],
};

const att = (id: string) => ({
  id,
  url: `https://dl.airtable.com/${id}`,
  filename: `${id}.png`,
  type: "image/png",
  size: 5,
});

// rec1 carries two attachments, rec2 one, rec3 none.
const RECORDS: AirtableRecordsPage = {
  records: [
    { id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "A", Files: [att("attA"), att("attB")] } },
    { id: "rec2", createdTime: "2026-01-02T00:00:00Z", fields: { Name: "B", Files: [att("attC")] } },
    { id: "rec3", createdTime: "2026-01-03T00:00:00Z", fields: { Name: "C" } },
  ],
};

function makeClient() {
  return {
    listBases: vi.fn(),
    getBaseSchema: vi.fn(async () => SCHEMA),
    listRecords: vi.fn(async () => RECORDS),
  };
}

// Prebuilt downloader fake returning the media metadata tap the real one
// produces: attA freshly written, attB + attC dedup-skipped.
function fakeDownloader(): AttachmentDownloader {
  return {
    processCell: vi.fn(async (attachments: AirtableAttachment[]): Promise<ProcessCellResult> => ({
      keys: attachments.map((a) => `att/${a.id}/${a.filename}`),
      downloaded: attachments.filter((a) => a.id === "attA").length,
      attachments: attachments.map((a) => ({
        attachmentId: a.id,
        filename: a.filename,
        storageKey: `att/${a.id}/${a.filename}`,
        // attB is a dedup-skip of the SAME content as attA — one asset, two refs.
        checksum: a.id === "attB" ? "sha256:attA" : `sha256:${a.id}`,
        contentType: "image/png",
        sizeBytes: 5,
        dedupSkipped: a.id !== "attA",
      })),
    })),
  };
}

const INPUT = {
  runId: "11111111-1111-4111-8111-111111111111",
  connectionId: "conn-1",
  atBaseId: "appXYZ",
  isTrial: false,
  encryptedToken: "cipher",
  orgSlug: "acme",
  spaceName: "MySpace",
  baseName: "ProjectsDB",
  runStartedAt: new Date("2026-05-02T12:00:00Z"),
  storageType: "r2_managed",
  spaceId: "space-1",
};

type SyncMediaMock = Mock<NonNullable<BackupBaseDeps["syncMedia"]>>;

const baseDeps = (
  over: Partial<BackupBaseDeps>,
): BackupBaseDeps & { syncMedia: SyncMediaMock } => ({
  engineUrl: ENGINE,
  internalToken: TOKEN,
  fetchImpl: makeFetchMock(),
  airtableClient: makeClient(),
  writeCsv: vi.fn(async () => ({})),
  getR2Creds: () => ({
    accountId: "acc",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucket: "bkt",
  }),
  attachmentDownloader: fakeDownloader(),
  syncMedia: vi.fn(async () => {}) as SyncMediaMock,
  ...over,
} as BackupBaseDeps & { syncMedia: SyncMediaMock });

describe("runBackupBase — media-metadata emission", () => {
  it("emits per-record complete captures (writes AND dedup-skips) with r2_managed locators", async () => {
    const deps = baseDeps({});
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(deps.syncMedia).toHaveBeenCalledTimes(1);
    const batch = deps.syncMedia.mock.calls[0]![0] as {
      baseId: string;
      records: MediaRecordCaptureWire[];
    };
    expect(batch.baseId).toBe("appXYZ");
    expect(batch.records).toEqual([
      {
        recordId: "rec1",
        tableId: "tbl1",
        complete: true,
        attachments: [
          {
            attachmentId: "attA",
            fieldId: "fldFiles",
            filename: "attA.png",
            checksum: "sha256:attA",
            contentType: "image/png",
            sizeBytes: 5,
            storage: { kind: "r2_managed", key: "att/attA/attA.png" },
          },
          {
            attachmentId: "attB",
            fieldId: "fldFiles",
            filename: "attB.png",
            checksum: "sha256:attA",
            contentType: "image/png",
            sizeBytes: 5,
            storage: { kind: "r2_managed", key: "att/attB/attB.png" },
          },
        ],
      },
      {
        recordId: "rec2",
        tableId: "tbl1",
        complete: true,
        attachments: [
          {
            attachmentId: "attC",
            fieldId: "fldFiles",
            filename: "attC.png",
            checksum: "sha256:attC",
            contentType: "image/png",
            sizeBytes: 5,
            storage: { kind: "r2_managed", key: "att/attC/attC.png" },
          },
        ],
      },
    ]);
    // rec3 (no attachments) never appears; assets dedup by checksum.
    expect(result.media).toEqual({ status: "captured", records: 2, assets: 2, refs: 3 });
  });

  it("BYOS storage types map to {kind:'destination', provider, locator}", async () => {
    const deps = baseDeps({ fetchStorageCreds: vi.fn(async () => null) });
    const result = await runBackupBase({ ...INPUT, storageType: "box" }, deps);

    expect(result.status).toBe("succeeded");
    const batch = deps.syncMedia.mock.calls[0]![0] as { records: MediaRecordCaptureWire[] };
    expect(batch.records[0]!.attachments[0]!.storage).toEqual({
      kind: "destination",
      provider: "box",
      locator: "att/attA/attA.png",
    });
  });

  it("local_fs omits the storage locator entirely (index still fills)", async () => {
    const deps = baseDeps({});
    const result = await runBackupBase({ ...INPUT, storageType: "local_fs" }, deps);

    expect(result.status).toBe("succeeded");
    const batch = deps.syncMedia.mock.calls[0]![0] as { records: MediaRecordCaptureWire[] };
    for (const rec of batch.records) {
      for (const a of rec.attachments) {
        expect(a).not.toHaveProperty("storage");
      }
    }
    expect(result.media).toEqual({ status: "captured", records: 2, assets: 2, refs: 3 });
  });

  it("media-sync outage: attachments export normally, run succeeds, media skipped(reason)", async () => {
    const syncMedia = vi.fn(async () => {
      throw new Error("media-sync 503");
    }) as SyncMediaMock;
    const deps = baseDeps({ syncMedia });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(3);
    // The export itself is untouched — attA still downloaded per record pass.
    expect(result.attachmentsProcessed).toBe(1);
    expect(result.media).toEqual({ status: "skipped", reason: "media-sync 503" });
  });

  it("media failure does not disturb the comment capture (and vice versa)", async () => {
    const syncMedia = vi.fn(async () => {
      throw new Error("media-sync 500");
    }) as SyncMediaMock;
    const deps = baseDeps({
      syncMedia,
      planComments: vi.fn(async () => ({ refresh: [], zeroCandidates: [] })),
      syncComments: vi.fn(async () => {}),
    });
    const result = await runBackupBase({ ...INPUT, commentsEnabled: true }, deps);

    expect(result.status).toBe("succeeded");
    expect(result.media).toEqual({ status: "skipped", reason: "media-sync 500" });
    expect(result.comments).toEqual({
      status: "captured",
      records: 0,
      comments: 0,
      skippedByPlan: 0,
    });
  });

  it("no syncMedia dep wired → zero media POSTs, no media outcome (unchanged behavior)", async () => {
    const deps = baseDeps({ syncMedia: undefined });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.media).toBeUndefined();
  });

  it("no attachment export (downloader absent) → no media outcome even with syncMedia wired", async () => {
    const deps = baseDeps({ attachmentDownloader: undefined });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(deps.syncMedia).not.toHaveBeenCalled();
    expect(result.media).toBeUndefined();
  });

  it("an injected downloader without the metadata tap emits nothing (tolerated)", async () => {
    const legacyDownloader: AttachmentDownloader = {
      processCell: vi.fn(async (attachments: AirtableAttachment[]) => ({
        keys: attachments.map((a) => `att/${a.id}`),
        downloaded: attachments.length,
      })),
    };
    const deps = baseDeps({ attachmentDownloader: legacyDownloader });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(deps.syncMedia).not.toHaveBeenCalled();
    // The emitter WAS active — it just had nothing to deliver.
    expect(result.media).toEqual({ status: "captured", records: 0, assets: 0, refs: 0 });
  });
});
