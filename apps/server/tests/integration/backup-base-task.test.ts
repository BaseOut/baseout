// Pure-function tests for the backup-base orchestration extracted from the
// Trigger.dev wrapper. Plan task 7.1 alt-path: extract task body to a pure
// function and test that, since the Trigger.dev test harness isn't wired in.
//
// The pure function takes injectable HTTP fetch + Airtable client deps. Tests
// use vi.fn() for both. R2 path correctness is verified by inspecting the
// /upload-csv call body, not by hitting real R2 (that's Phase 11 territory).

import { describe, expect, it, vi } from "vitest";
import { runBackupBase } from "../../trigger/tasks/backup-base";
import type {
  AirtableSchema,
  AirtableRecordsPage,
} from "../../trigger/tasks/_lib/airtable-client";

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
    async (input: RequestInfo | URL, init?: RequestInit) => {
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
      if (url.includes("/upload-csv")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({
            ok: true,
            key: body.key,
            size: String(body.body).length,
          }),
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
};

describe("runBackupBase", () => {
  it("happy path: 1 table, 2 records → 1 CSV uploaded with canonical key", async () => {
    const { fetchMock, calls } = makeFetchMock();
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
      },
    );

    expect(result).toEqual({
      status: "succeeded",
      tablesProcessed: 1,
      recordsProcessed: 2,
      attachmentsProcessed: 0,
    });

    const upload = calls.find((c) => c.url.includes("/upload-csv"));
    expect(upload).toBeDefined();
    const uploadBody = JSON.parse(String(upload!.init.body));
    expect(uploadBody.key).toBe(
      "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv",
    );
    expect(uploadBody.body).toContain("Name\r\nfoo\r\nbar");

    expect(calls.some((c) => c.url.endsWith("/lock"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/unlock"))).toBe(true);
    const tokenCall = calls.find((c) => c.url.endsWith("/token"));
    expect(tokenCall).toBeDefined();
    expect(JSON.parse(String(tokenCall!.init.body))).toEqual({
      encryptedToken: "cipher-A",
    });
  });

  it("trial mode with >5 tables → backs up first 5 only and returns trial_truncated", async () => {
    const { fetchMock, calls } = makeFetchMock();
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
      },
    );

    expect(result.status).toBe("trial_truncated");
    expect(result.tablesProcessed).toBe(5);
    expect(client.getBaseSchema).toHaveBeenCalledTimes(1);
    expect(client.listRecords).toHaveBeenCalledTimes(5);
    const uploadCalls = calls.filter((c) => c.url.includes("/upload-csv"));
    expect(uploadCalls).toHaveLength(5);
  });

  it("trial mode hits 1000-record cap mid-table → returns trial_complete", async () => {
    const { fetchMock, calls } = makeFetchMock();
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
      },
    );

    expect(result.status).toBe("trial_complete");
    expect(result.recordsProcessed).toBe(1000);
    expect(result.tablesProcessed).toBe(2);
    const uploadCalls = calls.filter((c) => c.url.includes("/upload-csv"));
    expect(uploadCalls).toHaveLength(2);
  });

  // Phase 10d: per-table progress callback.
  it("calls postProgress once per table after a successful upload", async () => {
    const { fetchMock } = makeFetchMock();
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

    const postProgress = vi.fn(async () => undefined);

    const result = await runBackupBase(
      { ...BASE_INPUT, isTrial: false },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
        postProgress,
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

  it("swallows a thrown postProgress so the backup still completes", async () => {
    const { fetchMock } = makeFetchMock();
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
      },
    );

    // Run still succeeds — /complete is the authoritative writer.
    expect(result.status).toBe("succeeded");
    expect(result.tablesProcessed).toBe(1);
    expect(postProgress).toHaveBeenCalledTimes(1);
  });
});
