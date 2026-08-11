// Pure-function tests for the restore-base orchestration.
//
// Mirror of backup-base-task.test.ts style. All external effects are injected
// via vi.fn() deps — no fs reads, no Airtable network calls, no engine POSTs.
//
// The orchestration (restore-base.ts) is TDD-first: these tests are written
// against the INTERFACE before the implementation exists.

import { describe, expect, it, vi } from "vitest";
import {
  runRestoreBase,
  type RestoreBaseInput,
  type RestoreBaseProgressEvent,
} from "../trigger/tasks/restore-base";

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

      if (url.includes("/lock")) {
        return new Response(JSON.stringify({ acquired: true }), { status: 200 });
      }
      if (url.includes("/unlock")) {
        return new Response(JSON.stringify({ released: true }), { status: 200 });
      }
      if (url.includes("/token")) {
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

/** Build a minimal CsvRow object representing one table's parsed CSV. */
function makeRows(n: number): Record<string, string>[] {
  return Array.from({ length: n }, (_, i) => ({ Name: `row${i}` }));
}

const BASE_INPUT: RestoreBaseInput = {
  restoreId: "restore-1",
  connectionId: "conn-1",
  sourceRunId: "run-src-1",
  atBaseId: "appXYZ",
  baseName: "ProjectsDB",
  isTrial: false,
  encryptedToken: "cipher-A",
  orgSlug: "acme",
  spaceName: "MySpace",
  storageType: "local_fs",
  spaceId: "space-1",
  scope: "base",
  scopeTarget: { baseId: "appXYZ" },
  sourceRunStartedAt: "2026-05-02T12:00:00.000Z",
};

// ── Happy path ──────────────────────────────────────────────────────────────

describe("runRestoreBase", () => {
  it("happy path: scope=base, 2 CSVs → denormalizes rows → creates records → posts progress per table → returns counts", async () => {
    const { fetchMock, calls } = makeFetchMock();

    // reader: lists 2 keys; readFile returns a CSV string per key
    const listKeys = vi.fn(async (_prefix: string) => [
      "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv",
      "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Projects.csv",
    ]);
    const readFile = vi.fn(async (key: string) => {
      if (key.includes("Tasks")) {
        return "Name\r\nfoo\r\nbar";
      }
      return "Name\r\nbaz";
    });
    const reader = {
      init: vi.fn(async () => undefined),
      listKeys,
      readFile,
      cleanup: vi.fn(async () => undefined),
    };

    // ensureRestoreTarget: returns stub target identifiers
    const ensureRestoreTarget = vi.fn(
      async (_opts: unknown): Promise<{ targetBaseId: string; targetTableId: string }> => ({
        targetBaseId: "appNEW",
        targetTableId: "tblNEW",
      }),
    );

    // createRecords: returns created count
    const createRecords = vi.fn(
      async (_baseId: string, _tableId: string, _token: string, records: unknown[]) => ({
        created: records.map((_r, i) => ({
          id: `recNew${i}`,
          createdTime: "2026-01-01",
          fields: {},
        })),
        errors: [],
      }),
    );

    const postProgress = vi.fn(async (_event: RestoreBaseProgressEvent) => undefined);

    const result = await runRestoreBase(BASE_INPUT, {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: fetchMock,
      reader,
      ensureRestoreTarget,
      createRecords,
      postProgress,
      // field types map: Name is singleLineText
      fieldTypes: new Map([["Name", "singleLineText"]]),
    });

    expect(result.status).toBe("succeeded");
    expect(result.tablesRestored).toBe(2);
    expect(result.recordsRestored).toBe(3); // 2 + 1
    expect(result.attachmentsRestored).toBe(0);

    // lock + unlock
    expect(calls.some((c) => c.url.includes("/lock"))).toBe(true);
    expect(calls.some((c) => c.url.includes("/unlock"))).toBe(true);

    // postProgress fired once per table
    expect(postProgress).toHaveBeenCalledTimes(2);
    expect(postProgress.mock.calls[0]![0].tableCompleted).toBe(true);
    expect(postProgress.mock.calls[0]![0].recordsAppended).toBe(2);
    expect(postProgress.mock.calls[1]![0].recordsAppended).toBe(1);

    // createRecords called for each table
    expect(createRecords).toHaveBeenCalledTimes(2);
    expect(reader.cleanup).toHaveBeenCalledTimes(1);
  });

  // ── scope='table' narrows to one CSV ─────────────────────────────────────

  it("scope=table reads only the one CSV matching the tableId", async () => {
    const { fetchMock } = makeFetchMock();

    const listKeys = vi.fn(async (_prefix: string) => [
      "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv",
    ]);
    const readFile = vi.fn(async (_key: string) => "Name\r\nfoo");
    const reader = {
      init: vi.fn(async () => undefined),
      listKeys,
      readFile,
      cleanup: vi.fn(async () => undefined),
    };

    const ensureRestoreTarget = vi.fn(async () => ({
      targetBaseId: "appNEW",
      targetTableId: "tblNEW",
    }));
    const createRecords = vi.fn(async (_a: string, _b: string, _c: string, records: unknown[]) => ({
      created: records.map((_r, i) => ({ id: `r${i}`, createdTime: "2026-01-01", fields: {} })),
      errors: [],
    }));

    const result = await runRestoreBase(
      {
        ...BASE_INPUT,
        scope: "table",
        scopeTarget: { baseId: "appXYZ", tableId: "tbl1" },
      },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        reader,
        ensureRestoreTarget,
        createRecords,
        postProgress: vi.fn(async () => undefined),
        fieldTypes: new Map([["Name", "singleLineText"]]),
      },
    );

    expect(result.status).toBe("succeeded");
    expect(result.tablesRestored).toBe(1);
    expect(result.recordsRestored).toBe(1);
    // Only one CSV key was listed — listKeys prefix should be narrowed to the specific table
    expect(listKeys).toHaveBeenCalledTimes(1);
    expect(createRecords).toHaveBeenCalledTimes(1);
  });

  // ── empty CSV (no data rows) ─────────────────────────────────────────────

  it("empty CSV (header-only) → no-op createRecords, still completes", async () => {
    const { fetchMock } = makeFetchMock();

    const reader = {
      init: vi.fn(async () => undefined),
      listKeys: vi.fn(async () => [
        "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Empty.csv",
      ]),
      readFile: vi.fn(async () => "Name\r\n"), // header only
      cleanup: vi.fn(async () => undefined),
    };
    const createRecords = vi.fn(async (_a: string, _b: string, _c: string, records: unknown[]) => ({
      created: records.map((_r, i) => ({ id: `r${i}`, createdTime: "2026-01-01", fields: {} })),
      errors: [],
    }));

    const result = await runRestoreBase(BASE_INPUT, {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: fetchMock,
      reader,
      ensureRestoreTarget: vi.fn(async () => ({ targetBaseId: "appNEW", targetTableId: "tblNEW" })),
      createRecords,
      postProgress: vi.fn(async () => undefined),
      fieldTypes: new Map(),
    });

    expect(result.status).toBe("succeeded");
    expect(result.recordsRestored).toBe(0);
    expect(result.tablesRestored).toBe(1);
    // createRecords may be skipped entirely for empty CSVs
    const totalCreated = createRecords.mock.calls.reduce(
      (sum, c) => sum + (c[3] as unknown[]).length,
      0,
    );
    expect(totalCreated).toBe(0);
  });

  // ── Airtable failure mid-table (partial counts) ──────────────────────────

  it("Airtable createRecords throws on second table → result surfaced with partial counts", async () => {
    const { fetchMock, calls: fetchCalls } = makeFetchMock();

    const reader = {
      init: vi.fn(async () => undefined),
      listKeys: vi.fn(async () => [
        "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/T1.csv",
        "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/T2.csv",
      ]),
      readFile: vi.fn(async () => "Name\r\nfoo"),
      cleanup: vi.fn(async () => undefined),
    };

    let callCount = 0;
    const createRecords = vi.fn(async (_a: string, _b: string, _c: string, records: unknown[]) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("Airtable 422: field validation failed");
      }
      return {
        created: records.map((_r, i) => ({ id: `r${i}`, createdTime: "2026-01-01", fields: {} })),
        errors: [],
      };
    });

    // Should throw (the pure function re-throws mid-table errors after releasing lock).
    let captured: unknown = null;
    try {
      await runRestoreBase(BASE_INPUT, {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        reader,
        ensureRestoreTarget: vi.fn(async () => ({ targetBaseId: "appNEW", targetTableId: "tblNEW" })),
        createRecords,
        postProgress: vi.fn(async () => undefined),
        fieldTypes: new Map([["Name", "singleLineText"]]),
      });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toContain("422");
    // unlock must still fire
    expect(fetchCalls.some((c) => c.url.includes("/unlock"))).toBe(true);
  });

  // ── lock contention retry ────────────────────────────────────────────────

  it("lock contention: 409 then 200 → proceeds after retry", async () => {
    let lockAttempts = 0;
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

        if (url.includes("/lock")) {
          lockAttempts++;
          if (lockAttempts === 1) {
            return new Response(JSON.stringify({ error: "locked" }), { status: 409 });
          }
          return new Response(JSON.stringify({ acquired: true }), { status: 200 });
        }
        if (url.includes("/unlock")) {
          return new Response(JSON.stringify({ released: true }), { status: 200 });
        }
        if (url.includes("/token")) {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          return new Response(
            JSON.stringify({ accessToken: `plaintext-${body.encryptedToken}` }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 500 });
      },
    ) as unknown as typeof fetch;

    const reader = {
      init: vi.fn(async () => undefined),
      listKeys: vi.fn(async () => [
        "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/T1.csv",
      ]),
      readFile: vi.fn(async () => "Name\r\nfoo"),
      cleanup: vi.fn(async () => undefined),
    };
    const createRecords = vi.fn(async (_a: string, _b: string, _c: string, records: unknown[]) => ({
      created: records.map((_r, i) => ({ id: `r${i}`, createdTime: "2026-01-01", fields: {} })),
      errors: [],
    }));

    const result = await runRestoreBase(BASE_INPUT, {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: fetchMock,
      reader,
      ensureRestoreTarget: vi.fn(async () => ({ targetBaseId: "appNEW", targetTableId: "tblNEW" })),
      createRecords,
      postProgress: vi.fn(async () => undefined),
      fieldTypes: new Map([["Name", "singleLineText"]]),
      sleepImpl: async () => undefined, // skip the real sleep in tests
    });

    expect(result.status).toBe("succeeded");
    expect(lockAttempts).toBe(2);
    expect(result.tablesRestored).toBe(1);
    expect(result.recordsRestored).toBe(1);
  });

  // ── trial caps ───────────────────────────────────────────────────────────

  it("trial mode with >5 CSVs → restores first 5 only, status=trial_truncated", async () => {
    const { fetchMock } = makeFetchMock();
    const keys = Array.from(
      { length: 7 },
      (_, i) => `acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/T${i + 1}.csv`,
    );
    const reader = {
      init: vi.fn(async () => undefined),
      listKeys: vi.fn(async () => keys),
      readFile: vi.fn(async () => "Name\r\nfoo"),
      cleanup: vi.fn(async () => undefined),
    };
    const createRecords = vi.fn(async (_a: string, _b: string, _c: string, records: unknown[]) => ({
      created: records.map((_r, i) => ({ id: `r${i}`, createdTime: "2026-01-01", fields: {} })),
      errors: [],
    }));

    const result = await runRestoreBase(
      { ...BASE_INPUT, isTrial: true },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        reader,
        ensureRestoreTarget: vi.fn(async () => ({ targetBaseId: "appNEW", targetTableId: "tblNEW" })),
        createRecords,
        postProgress: vi.fn(async () => undefined),
        fieldTypes: new Map([["Name", "singleLineText"]]),
      },
    );

    expect(result.status).toBe("trial_truncated");
    expect(result.tablesRestored).toBe(5);
    expect(createRecords).toHaveBeenCalledTimes(5);
  });

  it("trial mode hits 1000-record cap → status=trial_complete", async () => {
    const { fetchMock } = makeFetchMock();
    // 2 tables, each with 600 rows
    const make600Csv = () => {
      const lines = ["Name"];
      for (let i = 0; i < 600; i++) lines.push(`row${i}`);
      return lines.join("\r\n");
    };
    const reader = {
      init: vi.fn(async () => undefined),
      listKeys: vi.fn(async () => [
        "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/T1.csv",
        "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/T2.csv",
      ]),
      readFile: vi.fn(async () => make600Csv()),
      cleanup: vi.fn(async () => undefined),
    };
    const createRecords = vi.fn(async (_a: string, _b: string, _c: string, records: unknown[]) => ({
      created: records.map((_r, i) => ({ id: `r${i}`, createdTime: "2026-01-01", fields: {} })),
      errors: [],
    }));

    const result = await runRestoreBase(
      { ...BASE_INPUT, isTrial: true },
      {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        reader,
        ensureRestoreTarget: vi.fn(async () => ({ targetBaseId: "appNEW", targetTableId: "tblNEW" })),
        createRecords,
        postProgress: vi.fn(async () => undefined),
        fieldTypes: new Map([["Name", "singleLineText"]]),
      },
    );

    expect(result.status).toBe("trial_complete");
    expect(result.recordsRestored).toBe(1000);
  });

  // ── prefix computation via r2-path ───────────────────────────────────────

  it("listKeys called with prefix derived from r2-path (orgSlug/spaceName/baseName/timestamp/)", async () => {
    const { fetchMock } = makeFetchMock();
    const listKeys = vi.fn(async () => []);
    const reader = {
      init: vi.fn(async () => undefined),
      listKeys,
      readFile: vi.fn(async () => ""),
      cleanup: vi.fn(async () => undefined),
    };

    await runRestoreBase(BASE_INPUT, {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: fetchMock,
      reader,
      ensureRestoreTarget: vi.fn(async () => ({ targetBaseId: "appNEW", targetTableId: "tblNEW" })),
      createRecords: vi.fn(async () => ({ created: [], errors: [] })),
      postProgress: vi.fn(async () => undefined),
      fieldTypes: new Map(),
    });

    // prefix must be the directory portion: orgSlug/spaceName/baseName/timestamp/
    // The timestamp is derived from sourceRunStartedAt "2026-05-02T12:00:00.000Z"
    // → "2026-05-02T12-00-00Z" (colon → dash, strip ms)
    expect(listKeys).toHaveBeenCalledWith(
      "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/",
    );
  });

  // ── batching ─────────────────────────────────────────────────────────────

  it("createRecords receives records in ≤10-row batches (100-row CSV → 10 calls)", async () => {
    const { fetchMock } = makeFetchMock();
    const rows = Array.from({ length: 100 }, (_, i) => `row${i}`);
    const bigCsv = ["Name", ...rows].join("\r\n");
    const reader = {
      init: vi.fn(async () => undefined),
      listKeys: vi.fn(async () => [
        "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/T1.csv",
      ]),
      readFile: vi.fn(async () => bigCsv),
      cleanup: vi.fn(async () => undefined),
    };
    const createRecords = vi.fn(async (_a: string, _b: string, _c: string, records: unknown[]) => ({
      created: records.map((_r, i) => ({ id: `r${i}`, createdTime: "2026-01-01", fields: {} })),
      errors: [],
    }));

    const result = await runRestoreBase(BASE_INPUT, {
      engineUrl: ENGINE,
      internalToken: TOKEN,
      fetchImpl: fetchMock,
      reader,
      ensureRestoreTarget: vi.fn(async () => ({ targetBaseId: "appNEW", targetTableId: "tblNEW" })),
      createRecords,
      postProgress: vi.fn(async () => undefined),
      fieldTypes: new Map([["Name", "singleLineText"]]),
    });

    expect(result.recordsRestored).toBe(100);
    // 100 rows ÷ 10 per batch = 10 calls
    expect(createRecords).toHaveBeenCalledTimes(10);
    for (const call of createRecords.mock.calls) {
      expect((call[3] as unknown[]).length).toBeLessThanOrEqual(10);
    }
  });
});
