// Routing-layer tests for POST /api/internal/webhook-subscriptions/:id/context
// (server-dynamic-mode Phase 4.1, pairing with server-instant-webhook).
//
// The incremental-backup task resolves its payloads-poll auth here at run
// start: the Airtable webhook id (ach…), a decrypted Connection access token
// (via the ConnectionDO /token gate), and the reconciliation anchor — none of
// which ride the task payload (tokens must never appear in Trigger.dev run
// history). House pattern: this file pins the HTTP shape (401 / 405 / 400);
// the DB + DO paths (subscription join, token resolution, 404 / 409
// token_unavailable) ride the smoke checklist — the test harness has no live
// Postgres.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SUB_ID = "11111111-1111-1111-1111-111111111111";
const URL = `http://test/api/internal/webhook-subscriptions/${SUB_ID}/context`;

describe("POST /api/internal/webhook-subscriptions/:id/context — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(URL, { method: "POST" });
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
      "http://test/api/internal/webhook-subscriptions/not-a-uuid/context",
      {
        method: "POST",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });
});
