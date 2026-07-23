// Routing-layer tests for POST /api/internal/spaces/:id/incremental-apply
// (server-dynamic-mode, re-scoped). The apply path needs a provisioned
// managed_pg Space (no Postgres in the test pool), so this pins the HTTP
// guards; op semantics are pinned in per-space/incremental-apply.test.ts.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE = "11111111-1111-1111-1111-111111111111";
const auth = { "x-internal-token": TEST_TOKEN, "content-type": "application/json" };

const u = (s: string) => `http://test/api/internal/spaces/${s}/incremental-apply`;

describe("POST /api/internal/spaces/:id/incremental-apply", () => {
  it("401 without the internal token", async () => {
    expect((await SELF.fetch(u(SPACE), { method: "POST" })).status).toBe(401);
  });

  it("405 on non-POST", async () => {
    expect((await SELF.fetch(u(SPACE), { method: "GET", headers: auth })).status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(u("nope"), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ op: "list-table-ids", baseId: "appX" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 on a non-JSON body", async () => {
    const res = await SELF.fetch(u(SPACE), { method: "POST", headers: auth, body: "not-json" });
    expect(res.status).toBe(400);
  });

  it("400 with the parse reason on an unknown op", async () => {
    const res = await SELF.fetch(u(SPACE), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ op: "explode" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request", reason: "unknown_op" });
  });

  it("400 when an op body fails validation", async () => {
    const res = await SELF.fetch(u(SPACE), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ op: "open-base-run", backupRunId: "not-a-uuid", baseId: "appX" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request", reason: "bad_backup_run_id" });
  });
});
