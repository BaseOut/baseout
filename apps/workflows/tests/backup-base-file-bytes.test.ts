// File-byte accounting in runBackupBase (shared-entitlements 3.1).
//
// The backup task reports the file bytes it captured so the engine can roll
// them into the Space's `file_storage_gb` stock meter. "File bytes" =
// internal CSV snapshots + newly-written attachment bytes. Dedup-skipped
// attachments add NO net storage (their bytes are already under management),
// so they are excluded. Schema-only and early-fail paths report 0.

import { describe, expect, it, vi } from "vitest";
import { runBackupBase, type BackupBaseDeps } from "../trigger/tasks/backup-base";
import type {
  AirtableAttachment,
  AttachmentDownloader,
  ProcessCellResult,
} from "../trigger/tasks/_lib/attachment-downloader";
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

const byteLen = (s: string) => new TextEncoder().encode(s).byteLength;

const att = (id: string): AirtableAttachment => ({
  id,
  url: `https://dl.airtable.com/${id}`,
  filename: `${id}.bin`,
  type: "application/octet-stream",
  size: 5,
});

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
  storageType: "local_fs",
  spaceId: "space-1",
};

describe("runBackupBase file-byte accounting", () => {
  it("reports CSV snapshot bytes for a text-only run", async () => {
    const schema: AirtableSchema = {
      tables: [
        {
          id: "tbl1",
          name: "Tasks",
          primaryFieldId: "f1",
          fields: [{ id: "f1", name: "Name", type: "singleLineText" }],
          views: [],
        },
      ],
    };
    const records: AirtableRecordsPage = {
      records: [
        { id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "Alpha" } },
        { id: "rec2", createdTime: "2026-01-02T00:00:00Z", fields: { Name: "Beta" } },
      ],
    };
    const written: string[] = [];
    const deps: BackupBaseDeps = {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: makeFetchMock(),
      airtableClient: {
        getBaseSchema: vi.fn(async () => schema),
        listRecords: vi.fn(async () => records),
      },
      writeCsv: vi.fn(async (_key: string, csv: string) => {
        written.push(csv);
      }),
    };

    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(written).toHaveLength(1);
    expect(result.fileBytes).toBe(byteLen(written[0]!));
  });

  it("adds newly-written attachment bytes and excludes dedup skips", async () => {
    const schema: AirtableSchema = {
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
    const records: AirtableRecordsPage = {
      records: [
        { id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "A", Files: [att("attA"), att("attB")] } },
        { id: "rec2", createdTime: "2026-01-02T00:00:00Z", fields: { Name: "B", Files: [att("attC")] } },
      ],
    };
    // attA fresh (10B), attB dedup-skip (999B, excluded), attC fresh (20B).
    const SIZES: Record<string, number> = { attA: 10, attB: 999, attC: 20 };
    const SKIPPED = new Set(["attB"]);
    const downloader: AttachmentDownloader = {
      processCell: vi.fn(async (attachments: AirtableAttachment[]): Promise<ProcessCellResult> => ({
        keys: attachments.map((a) => `att/${a.id}`),
        downloaded: attachments.filter((a) => !SKIPPED.has(a.id)).length,
        attachments: attachments.map((a) => ({
          attachmentId: a.id,
          filename: a.filename,
          storageKey: `att/${a.id}`,
          checksum: `sha256:${a.id}`,
          sizeBytes: SIZES[a.id],
          dedupSkipped: SKIPPED.has(a.id),
        })),
      })),
    };
    const written: string[] = [];
    const deps: BackupBaseDeps = {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: makeFetchMock(),
      airtableClient: {
        getBaseSchema: vi.fn(async () => schema),
        listRecords: vi.fn(async () => records),
      },
      writeCsv: vi.fn(async (_key: string, csv: string) => {
        written.push(csv);
      }),
      attachmentDownloader: downloader,
    };

    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    // CSV bytes + attA(10) + attC(20); attB dedup-skip excluded.
    expect(result.fileBytes).toBe(byteLen(written[0]!) + 30);
  });

  it("reports 0 file bytes for a schema-only run", async () => {
    const schema: AirtableSchema = {
      tables: [
        {
          id: "tbl1",
          name: "Tasks",
          primaryFieldId: "f1",
          fields: [{ id: "f1", name: "Name", type: "singleLineText" }],
          views: [],
        },
      ],
    };
    const deps: BackupBaseDeps = {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: makeFetchMock(),
      airtableClient: {
        getBaseSchema: vi.fn(async () => schema),
        listRecords: vi.fn(async () => ({ records: [] })),
      },
    };

    const result = await runBackupBase({ ...INPUT, kind: "schema" }, deps);

    expect(result.status).toBe("succeeded");
    expect(result.fileBytes).toBe(0);
  });

  it("reports 0 file bytes when the run fails before writing", async () => {
    // Lock granted, token exchange rejected → an early `failed` return before
    // any CSV is written.
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/lock")) return new Response("{}", { status: 200 });
      if (url.endsWith("/unlock")) return new Response("{}", { status: 200 });
      if (url.endsWith("/token")) return new Response("nope", { status: 401 });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const deps: BackupBaseDeps = {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl,
      airtableClient: {
        getBaseSchema: vi.fn(),
        listRecords: vi.fn(),
      },
    };

    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("failed");
    expect(result.fileBytes).toBe(0);
  });
});
