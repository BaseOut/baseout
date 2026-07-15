// Routing-layer tests for GET /api/internal/connections/token-health
// (server-oauth-refresh-cron-health). DB-touching happy path is covered by
// the dev drill (no real PG in this harness — house pattern, see
// connections-whoami.test.ts).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";

describe("GET /api/internal/connections/token-health — routing", () => {
  it("rejects requests without x-internal-token (401)", async () => {
    const res = await SELF.fetch("http://test/api/internal/connections/token-health");
    expect(res.status).toBe(401);
  });

  it("rejects non-GET methods (405)", async () => {
    const res = await SELF.fetch("http://test/api/internal/connections/token-health", {
      method: "POST",
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(405);
    expect(((await res.json()) as { error: string }).error).toBe("method_not_allowed");
  });
});
