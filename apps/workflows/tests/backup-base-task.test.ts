// Pure-function tests for the backup-base orchestration extracted from the
// Trigger.dev wrapper. Plan task 7.1 alt-path: extract task body to a pure
// function and test that, since the Trigger.dev test harness isn't wired in.
//
// The pure function takes injectable HTTP fetch + Airtable client deps. Tests
// use vi.fn() for both. Backup-path correctness is verified by inspecting
// the deps.writeCsv injection — under workerd-vitest we can't reliably
// exercise the real fs writer, so the harness records the (relativeKey,
// csv) pairs and asserts on them. Real-disk behavior is covered by the
// manual smoke run.

import { describe, expect, it, vi } from "vitest";
import {
  runBackupBase,
  type BackupBaseProgressEvent,
} from "../trigger/tasks/backup-base";
import type {
  AirtableSchema,
  AirtableRecordsPage,
} from "../trigger/tasks/_lib/airtable-client";
import type { AttachmentDownloader } from "../trigger/tasks/_lib/attachment-downloader";

const ENGINE = "https://engine.example.com";
const TOKEN = "internal-token";

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function makeFetchMock(): {
  fetchMock: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      calls.push({ url, init: init ?? {} });

      if (url.endsWith("/lock")) {
        return new Response(JSON.stringify({ acquired: true }), {
          status: 200,
        });
      }
      if (url.endsWith("/unlock")) {
        return new Response(JSON.stringify({ released: true }), {
          status: 200,
        });
      }
      if (url.endsWith("/token")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({ accessToken: `plaintext-${body.encryptedToken}` }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: "unexpected_url" }), {
        status: 500,
      });
    },
  );
  return { fetchMock: fetchMock as unknown as typeof fetch, calls };
}

interface RecordedWrite {
  key: string;
  csv: string;
}

function makeWriteCsv(): {
  writeCsv: (key: string, csv: string) => Promise<unknown>;
  writes: RecordedWrite[];
} {
  const writes: RecordedWrite[] = [];
  const writeCsv = vi.fn(async (key: string, csv: string) => {
    writes.push({ key, csv });
    return { path: `/fake/.backups/${key}`, size: csv.length };
  });
  return { writeCsv, writes };
}

function makeAirtableClient(opts: {
  schema: AirtableSchema;
  pages: AirtableRecordsPage[];
}) {
  let pageIdx = 0;
  return {
    listBases: vi.fn(),
    getBaseSchema: vi.fn(async () => opts.schema),
    listRecords: vi.fn(async () => {
      const page = opts.pages[pageIdx] ?? { records: [] };
      pageIdx += 1;
      return page;
    }),
  };
}

const BASE_INPUT = {
  runId: "run-1",
  connectionId: "conn-1",
  atBaseId: "appXYZ",
  encryptedToken: "cipher-A",
  orgSlug: "acme",
  spaceName: "MySpace",
  baseName: "ProjectsDB",
  runStartedAt: new Date("2026-05-02T12:00:00Z"),
  // local_fs because most tests inject `deps.writeCsv` and don't care about the
  // resolved writer. The r2_managed-without-creds case has its own test below
  // that asserts the guard returns `failed`; tests that DO care about the r2
  // path override `storageType` and pass `getR2Creds` explicitly.
  storageType: "local_fs",
  spaceId: "space-1",
};

describe("runBackupBase", () => {
  it("happy path: 1 table, 2 records → 1 CSV written with canonical path", async () => {
    const { fetchMock, calls } = makeFetchMock();
    const { writeCsv, writes } = makeWriteCsv();
    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "Tasks",
            primaryFieldId: "fld1",
            fields: [{ id: "fld1", name: "Name", type: "singleLineText" }],
          },
        ],
      },
      pages: [
        {
          records: [
            { id: "rec1", createdTime: "2026-01-01", fields: { Name: "foo" } },
            { id: "rec2", createdTime: "2026-01-01", fields: { Name: "bar" } },
          ],
        },
      ],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
      },
    );

    expect(result).toMatchObject({
      status: "succeeded",
      tablesProcessed: 1,
      recordsProcessed: 2,
      attachmentsProcessed: 0,
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]!.key).toBe(
      "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv",
    );
    expect(writes[0]!.csv).toContain("Name\r\nfoo\r\nbar");

    expect(calls.some((c) => c.url.endsWith("/lock"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/unlock"))).toBe(true);
    const tokenCall = calls.find((c) => c.url.endsWith("/token"));
    expect(tokenCall).toBeDefined();
    expect(JSON.parse(String(tokenCall!.init.body))).toEqual({
      encryptedToken: "cipher-A",
    });
  });

  it("r2_managed consults getR2Creds (app-level env), not the engine storage-destination route", async () => {
    // openspec/changes/workflows-r2-writer: R2 creds come from getR2Creds,
    // never from fetchStorageCreds / the per-Space OAuth route.
    const { fetchMock } = makeFetchMock();
    const { writeCsv } = makeWriteCsv();
    const getR2Creds = vi.fn(() => ({
      accountId: "acct123",
      accessKeyId: "AKID",
      secretAccessKey: "secret",
      bucket: "baseout-backups",
    }));
    const fetchStorageCreds = vi.fn(async () => null);
    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "Tasks",
            primaryFieldId: "fld1",
            fields: [{ id: "fld1", name: "Name", type: "singleLineText" }],
          },
        ],
      },
      pages: [
        {
          records: [
            { id: "rec1", createdTime: "2026-01-01", fields: { Name: "foo" } },
          ],
        },
      ],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, storageType: "r2_managed", isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
        getR2Creds,
        fetchStorageCreds,
      },
    );

    expect(result.status).toBe("succeeded");
    expect(getR2Creds).toHaveBeenCalledTimes(1);
    expect(fetchStorageCreds).not.toHaveBeenCalled();
  });

  it("attachment field → downloader processes the cell, keys land in the CSV, count flows to result", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv, writes } = makeWriteCsv();
    const processCell = vi.fn<AttachmentDownloader["processCell"]>(async () => ({
      keys: ["acme/sp/base/attachments/cid1/a.png", "acme/sp/base/attachments/cid2/b.png"],
      downloaded: 2,
    }));
    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "Assets",
            primaryFieldId: "fld1",
            fields: [
              { id: "fld1", name: "Name", type: "singleLineText" },
              { id: "fld2", name: "Files", type: "multipleAttachments" },
            ],
          },
        ],
      },
      pages: [
        {
          records: [
            {
              id: "rec1",
              createdTime: "2026-01-01",
              fields: {
                Name: "row one",
                Files: [
                  { id: "att1", url: "https://dl/att1", filename: "a.png", type: "image/png" },
                  { id: "att2", url: "https://dl/att2", filename: "b.png", type: "image/png" },
                ],
              },
            },
          ],
        },
      ],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, storageType: "local_fs", isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
        attachmentDownloader: { processCell },
      },
    );

    expect(result.status).toBe("succeeded");
    expect(result.attachmentsProcessed).toBe(2);
    // processCell got the right DownloadContext (composite-ID inputs).
    expect(processCell).toHaveBeenCalledTimes(1);
    expect(processCell.mock.calls[0]![1]).toEqual({
      baseId: "appXYZ",
      tableId: "tbl1",
      recordId: "rec1",
      fieldId: "fld2",
    });
    // The CSV cell holds the semicolon-joined storage keys, not "[N attachments]".
    expect(writes).toHaveLength(1);
    expect(writes[0]!.csv).toContain(
      "acme/sp/base/attachments/cid1/a.png;acme/sp/base/attachments/cid2/b.png",
    );
    expect(writes[0]!.csv).not.toContain("attachments]");
  });

  it("trial mode with >5 tables → backs up first 5 only and returns trial_truncated", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv, writes } = makeWriteCsv();
    const tables = Array.from({ length: 7 }, (_, i) => ({
      id: `tbl${i + 1}`,
      name: `T${i + 1}`,
      primaryFieldId: "fld1",
      fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
    }));
    const client = makeAirtableClient({
      schema: { tables },
      pages: Array.from({ length: 7 }, () => ({
        records: [{ id: "r", createdTime: "2026-01-01", fields: { X: "v" } }],
      })),
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, isTrial: true },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
      },
    );

    expect(result.status).toBe("trial_truncated");
    expect(result.tablesProcessed).toBe(5);
    expect(client.getBaseSchema).toHaveBeenCalledTimes(1);
    expect(client.listRecords).toHaveBeenCalledTimes(5);
    expect(writes).toHaveLength(5);
  });

  it("trial mode hits 1000-record cap mid-table → returns trial_complete", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv, writes } = makeWriteCsv();
    // Two tables. First yields 600 records over two pages; second yields 600
    // records over one page. After table 1 (600 of 1000) we move to table 2;
    // table 2's first page (600) pushes total to 1200, so we trim to fit
    // 1000 cap (400 from table 2) and stop.
    const make600 = (prefix: string) =>
      Array.from({ length: 600 }, (_, i) => ({
        id: `${prefix}${i}`,
        createdTime: "2026-01-01",
        fields: { X: `v${i}` },
      }));
    const tables = [
      {
        id: "tbl1",
        name: "T1",
        primaryFieldId: "fld1",
        fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
      },
      {
        id: "tbl2",
        name: "T2",
        primaryFieldId: "fld1",
        fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
      },
    ];
    const client = makeAirtableClient({
      schema: { tables },
      pages: [
        { records: make600("a"), offset: undefined },
        { records: make600("b"), offset: undefined },
      ],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, isTrial: true },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
      },
    );

    expect(result.status).toBe("trial_complete");
    expect(result.recordsProcessed).toBe(1000);
    expect(result.tablesProcessed).toBe(2);
    expect(writes).toHaveLength(2);
  });

  // Phase 10d: per-table progress callback.
  it("calls postProgress once per table after a successful write", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv } = makeWriteCsv();
    const tables = [
      {
        id: "tbl1",
        name: "T1",
        primaryFieldId: "fld1",
        fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
      },
      {
        id: "tbl2",
        name: "T2",
        primaryFieldId: "fld1",
        fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
      },
      {
        id: "tbl3",
        name: "T3",
        primaryFieldId: "fld1",
        fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
      },
    ];
    const client = makeAirtableClient({
      schema: { tables },
      pages: [
        {
          records: [
            { id: "r1", createdTime: "2026-01-01", fields: { X: "a" } },
            { id: "r2", createdTime: "2026-01-01", fields: { X: "b" } },
          ],
        },
        {
          records: [
            { id: "r3", createdTime: "2026-01-01", fields: { X: "c" } },
          ],
        },
        {
          records: [
            { id: "r4", createdTime: "2026-01-01", fields: { X: "d" } },
            { id: "r5", createdTime: "2026-01-01", fields: { X: "e" } },
            { id: "r6", createdTime: "2026-01-01", fields: { X: "f" } },
          ],
        },
      ],
    });

    const postProgress = vi.fn(
      async (_event: BackupBaseProgressEvent) => undefined,
    );

    const result = await runBackupBase(
      { ...BASE_INPUT, isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        postProgress,
        writeCsv,
      },
    );

    expect(result.status).toBe("succeeded");
    expect(result.tablesProcessed).toBe(3);
    expect(result.recordsProcessed).toBe(6);

    // One fire per table, in upload order, with tableCompleted=true and
    // recordsAppended matching that table's page rows.
    expect(postProgress).toHaveBeenCalledTimes(3);
    expect(postProgress.mock.calls[0]![0]).toEqual({
      recordsAppended: 2,
      tableCompleted: true,
    });
    expect(postProgress.mock.calls[1]![0]).toEqual({
      recordsAppended: 1,
      tableCompleted: true,
    });
    expect(postProgress.mock.calls[2]![0]).toEqual({
      recordsAppended: 3,
      tableCompleted: true,
    });
  });

  // Regression: 2026-06-09 silent-hang root cause. Before this, the wrapper
  // threw on r2_managed-without-creds BEFORE entering the try/catch that
  // calls postCompletion, so engine-side `backup_runs` rows stayed
  // status='running' forever. Pushing the guard into the pure function makes
  // it a structured `failed` result instead — the wrapper's existing
  // postCompletion runs unchanged and the engine row flips.
  it("storageType='r2_managed' with no getR2Creds returns failed (does NOT throw, does NOT silently fall back to LocalFs)", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv } = makeWriteCsv();
    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "T1",
            primaryFieldId: "fld1",
            fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
          },
        ],
      },
      pages: [
        {
          records: [
            { id: "r1", createdTime: "2026-01-01", fields: { X: "a" } },
          ],
        },
      ],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, storageType: "r2_managed", isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
        // getR2Creds intentionally omitted — production wrapper builds these
        // from process.env and the env vars aren't set in the dev runner.
      },
    );

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/r2/i);
    expect(result.tablesProcessed).toBe(0);
    expect(result.recordsProcessed).toBe(0);
  });

  it("swallows a thrown postProgress so the backup still completes", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv } = makeWriteCsv();
    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "T1",
            primaryFieldId: "fld1",
            fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
          },
        ],
      },
      pages: [
        {
          records: [
            { id: "r1", createdTime: "2026-01-01", fields: { X: "a" } },
          ],
        },
      ],
    });

    const postProgress = vi.fn(async () => {
      throw new Error("transport boom");
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        postProgress,
        writeCsv,
      },
    );

    // Run still succeeds — /complete is the authoritative writer.
    expect(result.status).toBe("succeeded");
    expect(result.tablesProcessed).toBe(1);
    expect(postProgress).toHaveBeenCalledTimes(1);
  });

  // workflows-run-detail: per-table detail accumulation.
  // These tests assert that runBackupBase returns tableDetail in the result so
  // the wrapper can forward it to POST /api/internal/runs/:runId/complete, which
  // the server-run-detail handler then persists into backup_run_bases /
  // backup_run_tables.

  it("returns tableDetail with one entry per table including recordCount, fieldCount, attachmentCount=0 when no attachments", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv } = makeWriteCsv();
    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "Contacts",
            primaryFieldId: "fld1",
            fields: [
              { id: "fld1", name: "Name", type: "singleLineText" },
              { id: "fld2", name: "Email", type: "email" },
              { id: "fld3", name: "Phone", type: "phoneNumber" },
            ],
          },
          {
            id: "tbl2",
            name: "Tasks",
            primaryFieldId: "fld10",
            fields: [
              { id: "fld10", name: "Title", type: "singleLineText" },
              { id: "fld11", name: "Done", type: "checkbox" },
            ],
          },
        ],
      },
      pages: [
        // tbl1: 3 records
        {
          records: [
            { id: "r1", createdTime: "2026-01-01", fields: { Name: "Alice", Email: "a@x.com", Phone: "1" } },
            { id: "r2", createdTime: "2026-01-01", fields: { Name: "Bob", Email: "b@x.com", Phone: "2" } },
            { id: "r3", createdTime: "2026-01-01", fields: { Name: "Carol", Email: "c@x.com", Phone: "3" } },
          ],
        },
        // tbl2: 1 record
        {
          records: [
            { id: "r4", createdTime: "2026-01-01", fields: { Title: "Fix bug", Done: true } },
          ],
        },
      ],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
      },
    );

    expect(result.status).toBe("succeeded");
    expect(result.tablesProcessed).toBe(2);
    expect(result.recordsProcessed).toBe(4);

    // tableDetail must be present and have one entry per table.
    expect(result.tableDetail).toBeDefined();
    expect(result.tableDetail).toHaveLength(2);

    expect(result.tableDetail![0]).toEqual({
      tableId: "tbl1",
      tableName: "Contacts",
      recordCount: 3,
      fieldCount: 3,
      attachmentCount: 0,
    });
    expect(result.tableDetail![1]).toEqual({
      tableId: "tbl2",
      tableName: "Tasks",
      recordCount: 1,
      fieldCount: 2,
      attachmentCount: 0,
    });
  });

  it("tableDetail attachmentCount reflects attachments downloaded for that table", async () => {
    const { fetchMock } = makeFetchMock();
    const { writeCsv } = makeWriteCsv();
    // Two tables: tbl1 has 2 attachment downloads, tbl2 has 1.
    const processCell = vi
      .fn<AttachmentDownloader["processCell"]>()
      .mockResolvedValueOnce({ keys: ["k1", "k2"], downloaded: 2 }) // tbl1
      .mockResolvedValueOnce({ keys: ["k3"], downloaded: 1 });        // tbl2

    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "Assets",
            primaryFieldId: "fld1",
            fields: [
              { id: "fld1", name: "Name", type: "singleLineText" },
              { id: "fld2", name: "Files", type: "multipleAttachments" },
            ],
          },
          {
            id: "tbl2",
            name: "Docs",
            primaryFieldId: "fld10",
            fields: [
              { id: "fld10", name: "Title", type: "singleLineText" },
              { id: "fld11", name: "Attachments", type: "multipleAttachments" },
            ],
          },
        ],
      },
      pages: [
        {
          records: [
            {
              id: "r1",
              createdTime: "2026-01-01",
              fields: {
                Name: "row1",
                Files: [
                  { id: "att1", url: "https://dl/att1", filename: "a.png", type: "image/png" },
                  { id: "att2", url: "https://dl/att2", filename: "b.png", type: "image/png" },
                ],
              },
            },
          ],
        },
        {
          records: [
            {
              id: "r2",
              createdTime: "2026-01-01",
              fields: {
                Title: "doc1",
                Attachments: [
                  { id: "att3", url: "https://dl/att3", filename: "c.pdf", type: "application/pdf" },
                ],
              },
            },
          ],
        },
      ],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, storageType: "local_fs", isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
        attachmentDownloader: { processCell },
      },
    );

    expect(result.status).toBe("succeeded");
    expect(result.attachmentsProcessed).toBe(3);

    expect(result.tableDetail).toBeDefined();
    expect(result.tableDetail).toHaveLength(2);
    expect(result.tableDetail![0]).toEqual({
      tableId: "tbl1",
      tableName: "Assets",
      recordCount: 1,
      fieldCount: 2,
      attachmentCount: 2,
    });
    expect(result.tableDetail![1]).toEqual({
      tableId: "tbl2",
      tableName: "Docs",
      recordCount: 1,
      fieldCount: 2,
      attachmentCount: 1,
    });
  });

  it("tableDetail is absent (undefined) on failed results", async () => {
    // r2_managed without creds returns a structured `failed` — tableDetail
    // should not be present since no tables were processed.
    const { fetchMock } = makeFetchMock();
    const { writeCsv } = makeWriteCsv();
    const client = makeAirtableClient({
      schema: {
        tables: [
          {
            id: "tbl1",
            name: "T1",
            primaryFieldId: "fld1",
            fields: [{ id: "fld1", name: "X", type: "singleLineText" }],
          },
        ],
      },
      pages: [{ records: [] }],
    });

    const result = await runBackupBase(
      { ...BASE_INPUT, storageType: "r2_managed", isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        writeCsv,
        // getR2Creds intentionally omitted → failed result
      },
    );

    expect(result.status).toBe("failed");
    expect(result.tableDetail).toBeUndefined();
  });
});
