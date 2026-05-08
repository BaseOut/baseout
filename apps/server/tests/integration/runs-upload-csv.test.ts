// Tests POST /api/internal/runs/:runId/upload-csv — the proxy route the
// Trigger.dev backup-base task uses to write CSV bytes into R2 via the
// Worker's BACKUP_BUCKET binding (the task itself runs in Node, can't use
// the binding directly).
//
// Token gate is covered in middleware.test.ts; these tests cover the
// route's own validation + R2 write semantics.

import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "11111111-2222-3333-4444-555555555555";
const KEY = "acme/MainSpace/Tasks/2026-05-07T12:00:00Z/Tasks.csv";
const CSV =
  "id,name,priority\r\n" +
  "rec1,Buy milk,low\r\n" +
  'rec2,"Plan Q3, including offsite",high\r\n';

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

describe("POST /api/internal/runs/:runId/upload-csv", () => {
  beforeEach(async () => {
    await clearBucket();
  });

  it("writes the CSV body to R2 at the requested key with the requested content-type", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/upload-csv`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          key: KEY,
          contentType: "text/csv",
          body: CSV,
        }),
      },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; key: string; size: number };
    expect(json.ok).toBe(true);
    expect(json.key).toBe(KEY);
    expect(json.size).toBe(CSV.length);

    const stored = await (env as unknown as Bindings).BACKUP_BUCKET.get(KEY);
    expect(stored).not.toBeNull();
    expect(await stored!.text()).toBe(CSV);
    expect(stored!.httpMetadata?.contentType).toBe("text/csv");
  });

  it("rejects non-POST methods with 405", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/upload-csv`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/upload-csv`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: "not json",
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_json");
  });

  it("rejects missing/non-string key with 400", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/upload-csv`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ contentType: "text/csv", body: CSV }),
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("rejects missing body with 400", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/upload-csv`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ key: KEY, contentType: "text/csv" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("rejects keys that contain '..' to prevent path traversal", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/upload-csv`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          key: "acme/../escape/Tasks.csv",
          contentType: "text/csv",
          body: CSV,
        }),
      },
    );
    expect(res.status).toBe(400);
    const body = (env as unknown as Bindings).BACKUP_BUCKET;
    const list = await body.list();
    expect(list.objects).toHaveLength(0);
  });

  it("rejects malformed runId in the URL with 400", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/upload-csv`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          key: KEY,
          contentType: "text/csv",
          body: CSV,
        }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/upload-csv`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: KEY,
          contentType: "text/csv",
          body: CSV,
        }),
      },
    );
    expect(res.status).toBe(401);
  });
});
