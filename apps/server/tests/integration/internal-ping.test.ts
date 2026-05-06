// Tests the internal-ping handler shape. The token-gate behavior is covered
// in middleware.test.ts; this file pins the response body so future PRs that
// add real internal routes don't accidentally regress the smoke-test surface.

import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";

describe("GET /api/internal/ping", () => {
  it("returns the canonical pong shape with a numeric timestamp", async () => {
    const res = await SELF.fetch("http://test/api/internal/ping", {
      headers: { "x-internal-token": TEST_TOKEN },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = (await res.json()) as { pong: boolean; ts: number };
    expect(body.pong).toBe(true);
    expect(typeof body.ts).toBe("number");
  });
});
