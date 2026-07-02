// Routing-layer tests for POST /api/internal/spaces/:id/migrate-schema
// (system-per-space-upgrade). The actual upgrade needs a provisioned managed_pg
// Space (no Postgres in the test pool), so this pins the HTTP guards.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE = "11111111-1111-1111-1111-111111111111";
const auth = { "x-internal-token": TEST_TOKEN };

const u = (s: string) => `http://test/api/internal/spaces/${s}/migrate-schema`;

describe("POST /api/internal/spaces/:id/migrate-schema", () => {
  it("401 without the internal token", async () => {
    expect((await SELF.fetch(u(SPACE), { method: "POST" })).status).toBe(401);
  });

  it("405 on non-POST", async () => {
    expect((await SELF.fetch(u(SPACE), { method: "GET", headers: auth })).status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    expect((await SELF.fetch(u("nope"), { method: "POST", headers: auth })).status).toBe(400);
  });
});
