// Tests the only public route on the engine. CLAUDE.md §5.2 — /api/health is
// the engine's liveness probe; everything else is INTERNAL_TOKEN-gated.

import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("GET /api/health", () => {
  it("returns 200 with the canonical liveness shape", async () => {
    const res = await SELF.fetch("http://test/api/health");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = (await res.json()) as { ok: boolean; service: string; t: number };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("baseout-server");
    expect(typeof body.t).toBe("number");
  });

  it("does not require an internal token", async () => {
    // No x-internal-token header — middleware must let public paths through.
    const res = await SELF.fetch("http://test/api/health");
    expect(res.status).toBe(200);
  });
});
