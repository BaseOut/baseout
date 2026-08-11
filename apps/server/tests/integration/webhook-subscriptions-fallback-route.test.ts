// Routing-layer tests for POST /api/internal/webhook-subscriptions/:id/fallback
// (server-instant-webhook Phase D).
//
// The incremental-backup task signals a payload-stream gap here (cursor past
// the 7-day retention, INVALID_HOOK, …); the engine enqueues a full
// backup-base run for the affected base, stamps last_reconciled_at, and
// resets the cursor to Airtable's current. House pattern: HTTP shape only
// (401 / 405 / 400); DB + Airtable paths ride the smoke checklist.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SUB_ID = "11111111-1111-1111-1111-111111111111";
const URL = `http://test/api/internal/webhook-subscriptions/${SUB_ID}/fallback`;

describe("POST /api/internal/webhook-subscriptions/:id/fallback — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "cursor_expired" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST", async () => {
    const res = await SELF.fetch(URL, {
      method: "GET",
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(405);
  });

  it("returns 400 when the subscription id is not a UUID", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/webhook-subscriptions/nope/fallback",
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "cursor_expired" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: {
        "x-internal-token": TEST_TOKEN,
        "content-type": "application/json",
      },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ["missing", {}],
    ["empty", { reason: "" }],
    ["non-string", { reason: 42 }],
  ])("returns 400 when reason is %s", async (_label, body) => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: {
        "x-internal-token": TEST_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(400);
  });
});
