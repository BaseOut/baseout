// Routing-layer tests for POST /api/internal/webhook-subscriptions/:id/cursor
// (server-instant-webhook Phase D).
//
// The incremental-backup task POSTs its advanced payload cursor here after
// each durably-applied batch. House pattern: this file pins the HTTP shape
// (401 / 405 / 400); the DB paths (monotonic advance, 409 cursor_regression,
// 404 unknown subscription) ride the smoke checklist — the test harness has
// no live Postgres.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SUB_ID = "11111111-1111-1111-1111-111111111111";
const URL = `http://test/api/internal/webhook-subscriptions/${SUB_ID}/cursor`;

describe("POST /api/internal/webhook-subscriptions/:id/cursor — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cursor: 5 }),
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
      "http://test/api/internal/webhook-subscriptions/not-a-uuid/cursor",
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ cursor: 5 }),
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
    ["non-numeric", { cursor: "9" }],
    ["negative", { cursor: -1 }],
    ["zero", { cursor: 0 }],
    ["fractional", { cursor: 1.5 }],
  ])("returns 400 when cursor is %s", async (_label, body) => {
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
