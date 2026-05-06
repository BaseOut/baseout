// Smoke-tests the DO bindings by hitting the PoC __do-smoke route, which
// resolves ConnectionDO via idFromName('smoke-test') and forwards the request.
// Confirms: the DO binding is wired, migrations applied, fetch() shape stable.
//
// Phase 1 PR4 will replace these stubs with real ConnectionDO/SpaceDO logic
// (leaky-bucket throttling, scheduling, WebSocket fan-out) — these assertions
// will need to be reshaped at that time.

import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";

describe("GET /api/internal/__do-smoke", () => {
  it("forwards to ConnectionDO and returns the canonical {do, id} shape", async () => {
    const res = await SELF.fetch("http://test/api/internal/__do-smoke", {
      headers: { "x-internal-token": TEST_TOKEN },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = (await res.json()) as { do: string; id: string };
    expect(body.do).toBe("ConnectionDO");
    // idFromName('smoke-test') is deterministic — same input yields same hex id.
    expect(body.id).toMatch(/^[0-9a-f]+$/);
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("is rejected without an internal token (middleware gate)", async () => {
    const res = await SELF.fetch("http://test/api/internal/__do-smoke");
    expect(res.status).toBe(401);
  });
});
