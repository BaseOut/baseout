// Pins the 404 + 401 ordering for unknown paths. The middleware gate fires
// before the route table, so unknown paths under /api/internal/ return 401
// (not 404) — that's a deliberate part of the surface contract.

import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";

describe("unknown routes", () => {
  it("returns 404 JSON for unknown public paths", async () => {
    const res = await SELF.fetch("http://test/api/unknown");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("returns 401 (not 404) for unknown /api/internal/* paths without a token", async () => {
    // Documents the intentional ordering: middleware runs before the route
    // table, so the gate hides the existence of internal paths from
    // unauthenticated callers.
    const res = await SELF.fetch("http://test/api/internal/does-not-exist");
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown /api/internal/* paths with a valid token", async () => {
    const res = await SELF.fetch("http://test/api/internal/does-not-exist", {
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(404);
  });
});
