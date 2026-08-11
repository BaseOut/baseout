// Routing-layer tests for the retention cleanup endpoints
// (openspec/changes/server-retention-and-cleanup Phase C/D).
//
// Per the apps/server convention (see runs-detail-route.test.ts), only the
// routing layer is exercised here — token gate, method gate, body validation.
// The DB-touching 200 paths are human-smoked via curl during the Phase C
// checkpoint:
//
//   # plan (returns the delete plan across all Spaces):
//   curl -s -XPOST -H "x-internal-token: <TOKEN>" \
//        "https://baseout-server-dev.<acct>.workers.dev/api/internal/cleanup-plan"
//   # → { "runs": [{ runId, spaceId, storageType, prefixes }] }
//
//   # complete (flips deleted_at after the workflows cron deletes the files):
//   curl -s -XPOST -H "x-internal-token: <TOKEN>" -H "content-type: application/json" \
//        -d '{"completed":[{"runId":"<uuid>","ok":true}]}' \
//        ".../api/internal/cleanup-complete"   # → { "updated": <n> }

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TOKEN = "test-only-internal-token-min-32-chars-aaaa";

describe("POST /api/internal/cleanup-plan — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch("http://test/api/internal/cleanup-plan", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch("http://test/api/internal/cleanup-plan", {
      method: "GET",
      headers: { "x-internal-token": TOKEN },
    });
    expect(res.status).toBe(405);
  });
});

describe("POST /api/internal/cleanup-complete — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch("http://test/api/internal/cleanup-complete", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch("http://test/api/internal/cleanup-complete", {
      method: "GET",
      headers: { "x-internal-token": TOKEN },
    });
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request on a malformed body", async () => {
    const res = await SELF.fetch("http://test/api/internal/cleanup-complete", {
      method: "POST",
      headers: { "x-internal-token": TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ not: "a valid body" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 200 { updated: 0 } when no runIds are marked ok (no DB write)", async () => {
    // An empty/all-failed completion list short-circuits before touching the DB,
    // so this path is safe to assert without a live Postgres.
    const res = await SELF.fetch("http://test/api/internal/cleanup-complete", {
      method: "POST",
      headers: { "x-internal-token": TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ completed: [{ runId: "x", ok: false }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { updated: number };
    expect(body.updated).toBe(0);
  });
});
