// Unit tests for the Airtable client helper used by Trigger.dev backup tasks.
//
// This client runs in Node (Trigger.dev runner) in production but is platform-
// neutral — it only uses fetch(), so it runs unchanged inside the workerd
// vitest pool. We exercise it via injected `fetchImpl` so tests don't make
// real Airtable calls.
//
// Coverage:
//   - listBases       — GET /v0/meta/bases
//   - getBaseSchema   — GET /v0/meta/bases/:baseId/tables
//   - listRecords     — GET /v0/:baseId/:tableId?pageSize=...&offset=...
//   - 429 retries     — exponential backoff, max 3 attempts, respects Retry-After
//   - non-2xx surface — error shape callers can branch on

import { describe, expect, it, vi } from "vitest";
import { createAirtableClient } from "../../trigger/tasks/_lib/airtable-client";

const TOKEN = "pat_test_aaaabbbbccccdddd";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("createAirtableClient.listBases", () => {
  it("GETs /v0/meta/bases with bearer token and returns base summaries", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        bases: [
          { id: "app123", name: "Customers", permissionLevel: "create" },
          { id: "app456", name: "Orders", permissionLevel: "read" },
        ],
      }),
    );
    const client = createAirtableClient({ accessToken: TOKEN, fetchImpl });
    const bases = await client.listBases();

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.airtable.com/v0/meta/bases");
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers.accept).toBe("application/json");
    expect(bases).toEqual([
      { id: "app123", name: "Customers", permissionLevel: "create" },
      { id: "app456", name: "Orders", permissionLevel: "read" },
    ]);
  });
});

describe("createAirtableClient.getBaseSchema", () => {
  it("GETs /v0/meta/bases/:baseId/tables and returns the tables array", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        tables: [
          {
            id: "tbl1",
            name: "Tasks",
            primaryFieldId: "fld1",
            fields: [
              { id: "fld1", name: "Title", type: "singleLineText" },
              { id: "fld2", name: "Done", type: "checkbox" },
            ],
          },
          {
            id: "tbl2",
            name: "People",
            primaryFieldId: "fld10",
            fields: [
              { id: "fld10", name: "Name", type: "singleLineText" },
              { id: "fld11", name: "Tasks", type: "multipleRecordLinks" },
            ],
          },
        ],
      }),
    );
    const client = createAirtableClient({ accessToken: TOKEN, fetchImpl });
    const schema = await client.getBaseSchema("app123");

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.airtable.com/v0/meta/bases/app123/tables",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(schema.tables).toHaveLength(2);
    expect(schema.tables[0]!.id).toBe("tbl1");
    expect(schema.tables[0]!.fields).toHaveLength(2);
    expect(schema.tables[0]!.fields[0]!.name).toBe("Title");
  });

  it("encodes the baseId path segment", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ tables: [] }));
    const client = createAirtableClient({ accessToken: TOKEN, fetchImpl });
    await client.getBaseSchema("app/with/slashes");
    const [url] = fetchImpl.mock.calls[0]!;
    // Path-segment encoding so a malformed id can't escape the URL shape.
    expect(String(url)).toBe(
      "https://api.airtable.com/v0/meta/bases/app%2Fwith%2Fslashes/tables",
    );
  });
});

// noopSleep is the test seam for retry-delay timing — production uses
// setTimeout-based sleep, tests skip the wall-clock wait.
const noopSleep = (): Promise<void> => Promise.resolve();

describe("createAirtableClient.listRecords", () => {
  it("GETs /v0/:baseId/:tableId with default pageSize and no offset", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        records: [
          { id: "rec1", createdTime: "2026-05-01T00:00:00Z", fields: { Name: "A" } },
          { id: "rec2", createdTime: "2026-05-02T00:00:00Z", fields: { Name: "B" } },
        ],
      }),
    );
    const client = createAirtableClient({ accessToken: TOKEN, fetchImpl });
    const page = await client.listRecords("app123", "tbl1");

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.airtable.com/v0/app123/tbl1?pageSize=100",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(page.records).toHaveLength(2);
    expect(page.offset).toBeUndefined();
  });

  it("passes through the offset query when provided", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        records: [
          { id: "rec3", createdTime: "2026-05-03T00:00:00Z", fields: {} },
        ],
        offset: "next-page-cursor",
      }),
    );
    const client = createAirtableClient({ accessToken: TOKEN, fetchImpl });
    const page = await client.listRecords("app123", "tbl1", {
      offset: "page-2-cursor",
    });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.airtable.com/v0/app123/tbl1?pageSize=100&offset=page-2-cursor",
    );
    expect(page.offset).toBe("next-page-cursor");
  });

  it("respects an explicit pageSize override", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ records: [] }));
    const client = createAirtableClient({ accessToken: TOKEN, fetchImpl });
    await client.listRecords("app123", "tbl1", { pageSize: 50 });
    const [url] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.airtable.com/v0/app123/tbl1?pageSize=50",
    );
  });

  it("path-encodes baseId and tableIdOrName", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ records: [] }));
    const client = createAirtableClient({ accessToken: TOKEN, fetchImpl });
    // Table NAME (vs id) can contain spaces — Airtable accepts both.
    await client.listRecords("app123", "My Tasks");
    const [url] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.airtable.com/v0/app123/My%20Tasks?pageSize=100",
    );
  });
});

describe("createAirtableClient — 429 retry", () => {
  it("retries once after a 429 and returns the eventual 200", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noopSleep);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ records: [{ id: "r1", createdTime: "t", fields: {} }] }));
    const client = createAirtableClient({
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl: sleep,
    });
    const page = await client.listRecords("app123", "tbl1");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(page.records).toHaveLength(1);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("retries up to 3 attempts total (initial + 2 retries) before giving up", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noopSleep);
    // Each fetch call needs a FRESH Response — bodies are one-shot, so
    // `mockResolvedValue(sameResponse)` would throw on the 2nd attempt's text().
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ error: { type: "RATE_LIMIT" } }, 429)),
      );
    const client = createAirtableClient({
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl: sleep,
    });

    await expect(client.listRecords("app123", "tbl1")).rejects.toMatchObject({
      name: "AirtableError",
      status: 429,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Two waits between three attempts.
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("respects Retry-After (in seconds) when the header is present", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noopSleep);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(jsonResponse({ records: [] }));
    const client = createAirtableClient({
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl: sleep,
    });
    await client.listRecords("app123", "tbl1");

    expect(sleep).toHaveBeenCalledOnce();
    // Retry-After: 2 → 2000 ms
    expect(sleep.mock.calls[0]![0]).toBe(2000);
  });

  it("uses exponential backoff when Retry-After is absent (200ms, 800ms)", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noopSleep);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ records: [] }));
    const client = createAirtableClient({
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl: sleep,
    });
    await client.listRecords("app123", "tbl1");

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls[0]![0]).toBe(200);
    expect(sleep.mock.calls[1]![0]).toBe(800);
  });

  it("does NOT retry on non-429 4xx — surfaces the error immediately", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noopSleep);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: "AUTH_REQUIRED" }, 401));
    const client = createAirtableClient({
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl: sleep,
    });

    await expect(client.listRecords("app123", "tbl1")).rejects.toMatchObject({
      name: "AirtableError",
      status: 401,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries 5xx server errors with the same exponential backoff", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noopSleep);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ records: [] }));
    const client = createAirtableClient({
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl: sleep,
    });
    await client.listRecords("app123", "tbl1");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("retries on the schema endpoint too (retry policy is per-request, not per-method)", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noopSleep);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ tables: [] }));
    const client = createAirtableClient({
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl: sleep,
    });
    await client.getBaseSchema("app123");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
