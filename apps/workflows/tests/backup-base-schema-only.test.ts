// Tests for schema-only runs (openspec/changes/workflows-schema-only-backup).
// A kind='schema' run captures + syncs the base schema but skips the record /
// CSV / attachment loop entirely. Mirrors the harness in
// backup-base-per-space-sync.test.ts.

import { describe, expect, it, vi } from "vitest";
import { runBackupBase } from "../trigger/tasks/backup-base";
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
      description: "All tasks",
      fields: [
        { id: "f1", name: "Name", type: "singleLineText" },
        { id: "f2", name: "Amount", type: "number" },
      ],
      views: [{ id: "viw1", name: "Grid", type: "grid" }],
    },
  ],
};

const PAGES: AirtableRecordsPage[] = [
  {
    records: [
      { id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "A", Amount: 1 } },
      { id: "rec2", createdTime: "2026-01-02T00:00:00Z", fields: { Name: "B" } },
    ],
  },
];

function makeClient() {
  let i = 0;
  return {
    listBases: vi.fn(),
    getBaseSchema: vi.fn(async () => SCHEMA),
    listRecords: vi.fn(async () => PAGES[i++] ?? { records: [] }),
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
  storageType: "local_fs",
  spaceId: "space-1",
};

const baseDeps = (over: Record<string, unknown>) => ({
  engineUrl: ENGINE,
  internalToken: TOKEN,
  fetchImpl: makeFetchMock(),
  airtableClient: makeClient(),
  writeCsv: vi.fn(async () => ({})),
  ...over,
});

describe("runBackupBase — schema-only (kind='schema')", () => {
  it("captures + syncs schema but skips records, CSV, and attachments", async () => {
    const syncSchema = vi.fn(async () => ({ recordsEnabled: true, baseRunId: "br-1" }));
    const syncRecords = vi.fn(async () => {});
    const writeCsv = vi.fn(async () => ({}));
    const client = makeClient();

    const result = await runBackupBase(
      { ...INPUT, kind: "schema" },
      baseDeps({ syncSchema, syncRecords, writeCsv, airtableClient: client }),
    );

    expect(syncSchema).toHaveBeenCalledOnce();
    expect(client.listRecords).not.toHaveBeenCalled();
    expect(syncRecords).not.toHaveBeenCalled();
    expect(writeCsv).not.toHaveBeenCalled();
    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(0);
    expect(result.attachmentsProcessed).toBe(0);
    expect(result.tablesProcessed).toBe(1);
    expect(result.tableDetail).toEqual([
      { tableId: "tbl1", tableName: "Tasks", recordCount: 0, fieldCount: 2, attachmentCount: 0 },
    ]);
  });

  it("does not require R2 creds even when storageType is r2_managed", async () => {
    // A full r2_managed run with no getR2Creds fails 'missing_r2_creds'; a
    // schema run never touches storage, so it must succeed.
    const syncSchema = vi.fn(async () => ({ recordsEnabled: false, baseRunId: "br-1" }));
    const result = await runBackupBase(
      { ...INPUT, kind: "schema", storageType: "r2_managed" },
      baseDeps({ syncSchema }),
    );
    expect(result.status).toBe("succeeded");
  });
});

describe("runBackupBase — full (kind='full' / absent) is unchanged", () => {
  it("still writes CSV and processes records", async () => {
    const writeCsv = vi.fn(async () => ({}));
    const result = await runBackupBase({ ...INPUT, kind: "full" }, baseDeps({ writeCsv }));
    expect(writeCsv).toHaveBeenCalledOnce();
    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(2);
  });
});
