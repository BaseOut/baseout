// Tests the Trigger.dev-task-side helper that POSTs CSV bytes to apps/
// server's /api/internal/runs/:runId/upload-csv proxy route.
//
// This helper runs in Node (Trigger.dev runner) in production. The test
// invokes it inside the workerd vitest pool, but the helper itself is
// platform-neutral — it only uses fetch(). We exercise it against the
// real route via SELF.fetch (happy path, real R2 write) and against an
// injected stub fetch (failure-path coverage).

import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { putCsvViaProxy } from "../../trigger/tasks/_lib/r2-proxy-write";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "11111111-2222-3333-4444-555555555555";
const KEY = "acme/MainSpace/Tasks/2026-05-07T12:00:00Z/Tasks.csv";
const CSV = "id,name\r\nrec1,Buy milk\r\n";

interface Bindings {
  BACKUP_BUCKET: R2Bucket;
}

async function clearBucket(): Promise<void> {
  const list = await (env as unknown as Bindings).BACKUP_BUCKET.list();
  await Promise.all(
    list.objects.map((o) =>
      (env as unknown as Bindings).BACKUP_BUCKET.delete(o.key),
    ),
  );
}

describe("putCsvViaProxy — happy path against real upload-csv route", () => {
  beforeEach(async () => {
    await clearBucket();
  });

  it("writes the CSV and returns ok with key + size", async () => {
    const result = await putCsvViaProxy({
      engineUrl: "http://test",
      internalToken: TEST_TOKEN,
      runId: RUN_ID,
      key: KEY,
      csv: CSV,
      fetchImpl: SELF.fetch.bind(SELF) as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toBe(KEY);
      expect(result.size).toBe(CSV.length);
    }

    const stored = await (env as unknown as Bindings).BACKUP_BUCKET.get(KEY);
    expect(stored).not.toBeNull();
    expect(await stored!.text()).toBe(CSV);
    expect(stored!.httpMetadata?.contentType).toBe("text/csv");
  });

  it("trims a trailing slash from engineUrl so URLs aren't malformed", async () => {
    const result = await putCsvViaProxy({
      engineUrl: "http://test/",
      internalToken: TEST_TOKEN,
      runId: RUN_ID,
      key: KEY,
      csv: CSV,
      fetchImpl: SELF.fetch.bind(SELF) as typeof fetch,
    });
    expect(result.ok).toBe(true);
  });
});

describe("putCsvViaProxy — failure paths via injected stub fetch", () => {
  it("maps 401 unauthorized to { ok: false, status: 401, error: 'unauthorized' }", async () => {
    const stub = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await putCsvViaProxy({
      engineUrl: "http://stub",
      internalToken: "wrong",
      runId: RUN_ID,
      key: KEY,
      csv: CSV,
      fetchImpl: stub as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("unauthorized");
    }
  });

  it("maps 400 invalid_request to { ok: false, status: 400, error: 'invalid_request' }", async () => {
    const stub = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_request" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await putCsvViaProxy({
      engineUrl: "http://stub",
      internalToken: TEST_TOKEN,
      runId: RUN_ID,
      key: KEY,
      csv: CSV,
      fetchImpl: stub as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("invalid_request");
    }
  });

  it("returns { ok: false, status: 0, error: 'unreachable' } on network error", async () => {
    const stub = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await putCsvViaProxy({
      engineUrl: "http://stub",
      internalToken: TEST_TOKEN,
      runId: RUN_ID,
      key: KEY,
      csv: CSV,
      fetchImpl: stub as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(0);
      expect(result.error).toBe("unreachable");
    }
  });

  it("falls back to 'unknown' when response body has no error code", async () => {
    const stub = vi.fn(
      async () => new Response("internal error", { status: 500 }),
    );
    const result = await putCsvViaProxy({
      engineUrl: "http://stub",
      internalToken: TEST_TOKEN,
      runId: RUN_ID,
      key: KEY,
      csv: CSV,
      fetchImpl: stub as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("unknown");
    }
  });

  it("sends method=POST, x-internal-token header, and JSON body to the canonical URL", async () => {
    const stub = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, key: KEY, size: CSV.length }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await putCsvViaProxy({
      engineUrl: "http://stub.example",
      internalToken: TEST_TOKEN,
      runId: RUN_ID,
      key: KEY,
      csv: CSV,
      fetchImpl: stub as unknown as typeof fetch,
    });

    expect(stub).toHaveBeenCalledOnce();
    const [calledUrl, init] = stub.mock.calls[0]!;
    expect(String(calledUrl)).toBe(
      `http://stub.example/api/internal/runs/${RUN_ID}/upload-csv`,
    );
    const reqInit = init as RequestInit;
    expect(reqInit.method).toBe("POST");
    const headers = reqInit.headers as Record<string, string>;
    expect(headers["x-internal-token"]).toBe(TEST_TOKEN);
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(reqInit.body as string) as {
      key: string;
      contentType: string;
      body: string;
    };
    expect(body.key).toBe(KEY);
    expect(body.contentType).toBe("text/csv");
    expect(body.body).toBe(CSV);
  });
});
