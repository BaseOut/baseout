// Tests for the per-Space DB sync wiring in runBackupBase (system-per-space-db
// §3c, Option B). Asserts the writer POSTs the captured schema to syncSchema
// and — only when records are enabled — the per-table records to syncRecords,
// with cells keyed by fieldId. Mirrors the harness in backup-base-task.test.ts.

import { describe, expect, it, vi } from "vitest";
import {
  runBackupBase,
  type CapturedBaseWire,
  type CapturedRecordWire,
} from "../trigger/tasks/backup-base";
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
        { id: "f2", name: "Amount", type: "number" },
      ],
    },
  ],
};

const PAGES: AirtableRecordsPage[] = [
  {
    records: [
      { id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "A", Amount: 1 } },
      { id: "rec2", createdTime: "2026-01-02T00:00:00Z", fields: { Name: "B" } }, // Amount empty → omitted
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

describe("runBackupBase — per-Space schema sync", () => {
  it("POSTs the captured base schema (fieldId + isPrimary mapped), confident=true", async () => {
    let captured: CapturedBaseWire | null = null;
    let confidentArg: boolean | null = null;
    const syncSchema = vi.fn(async (c: CapturedBaseWire, confident: boolean) => {
      captured = c;
      confidentArg = confident;
      return { recordsEnabled: false, baseRunId: "br-1" };
    });
    await runBackupBase(INPUT, baseDeps({ syncSchema }));

    expect(syncSchema).toHaveBeenCalledOnce();
    expect(confidentArg).toBe(true);
    expect(captured!.baseId).toBe("appXYZ");
    expect(captured!.name).toBe("ProjectsDB");
    const t = captured!.tables[0]!;
    expect(t.tableId).toBe("tbl1");
    expect(t.primaryFieldId).toBe("f1");
    expect(t.fields.map((f) => [f.fieldId, f.name, f.isPrimary])).toEqual([
      ["f1", "Name", true],
      ["f2", "Amount", false],
    ]);
  });
});

describe("runBackupBase — per-Space records sync", () => {
  it("syncs records per table (cells keyed by fieldId) when records are enabled", async () => {
    const calls: { tableId: string; records: CapturedRecordWire[]; confident: boolean }[] = [];
    const syncSchema = vi.fn(async () => ({ recordsEnabled: true, baseRunId: "br-1" }));
    const syncRecords = vi.fn(async (a: { baseId: string; tableId: string; records: CapturedRecordWire[]; confident: boolean }) => {
      calls.push({ tableId: a.tableId, records: a.records, confident: a.confident });
    });
    await runBackupBase(INPUT, baseDeps({ syncSchema, syncRecords }));

    expect(syncRecords).toHaveBeenCalledOnce();
    expect(calls[0]!.tableId).toBe("tbl1");
    expect(calls[0]!.confident).toBe(true);
    // Cells keyed by fieldId; rec2's empty Amount is omitted (Airtable behavior).
    expect(calls[0]!.records).toEqual([
      { recordId: "rec1", createdTime: "2026-01-01T00:00:00Z", modifiedTime: null, cells: { f1: "A", f2: 1 } },
      { recordId: "rec2", createdTime: "2026-01-02T00:00:00Z", modifiedTime: null, cells: { f1: "B" } },
    ]);
  });

  it("does NOT sync records when records are disabled", async () => {
    const syncSchema = vi.fn(async () => ({ recordsEnabled: false, baseRunId: "br-1" }));
    const syncRecords = vi.fn(async () => {});
    await runBackupBase(INPUT, baseDeps({ syncSchema, syncRecords }));
    expect(syncRecords).not.toHaveBeenCalled();
  });

  it("skips per-Space sync entirely when syncSchema is absent (static-only, unchanged behavior)", async () => {
    const syncRecords = vi.fn(async () => {});
    const result = await runBackupBase(INPUT, baseDeps({ syncRecords }));
    expect(syncRecords).not.toHaveBeenCalled();
    expect(result.status).toBe("succeeded");
  });
});
