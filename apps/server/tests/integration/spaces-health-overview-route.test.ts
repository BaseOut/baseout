// Routing-layer tests for GET /api/internal/spaces/:spaceId/health-overview.
//
// apps/web's Health tab proxy reads a base's grade + breakdown + issues here.
// Pure-DB behavior needs a provisioned managed_pg Space (no Postgres in the test
// pool), so this file pins the HTTP guards: token (401), method (405), UUID +
// missing baseId (400).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";

function url(spaceId: string, baseId?: string): string {
  const base = `http://test/api/internal/spaces/${spaceId}/health-overview`;
  return baseId ? `${base}?baseId=${baseId}` : base;
}

describe("GET /api/internal/spaces/:spaceId/health-overview — routing layer", () => {
  it("returns 401 without the internal token", async () => {
    const res = await SELF.fetch(url(SPACE_ID, "appXYZ"), { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-GET", async () => {
    const res = await SELF.fetch(url(SPACE_ID, "appXYZ"), {
      method: "POST",
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(405);
  });

  it("returns 400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(url("not-a-uuid", "appXYZ"), {
      method: "GET",
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when baseId is missing", async () => {
    const res = await SELF.fetch(url(SPACE_ID), {
      method: "GET",
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(400);
  });
});
