// Routing-layer tests for Automations / Interfaces manual-CRUD routes
// (server-automations-interfaces-manual-crud):
//   GET  /api/internal/spaces/:id/automations
//   POST /api/internal/spaces/:id/automations/mutate
//   GET  /api/internal/spaces/:id/interfaces
//   POST /api/internal/spaces/:id/interfaces/mutate
//
// Pure-DB behavior needs a provisioned managed_pg Space (no Postgres in the
// workers test pool), so this pins the HTTP guards: token (401), method (405),
// UUID + body validation (400).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const auth = { "x-internal-token": TEST_TOKEN, "content-type": "application/json" };

describe("GET /api/internal/spaces/:id/automations", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/automations`;

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("405 on non-GET", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "PUT", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(u("not-a-uuid"), { method: "GET", headers: auth });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/internal/spaces/:id/automations/mutate", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/automations/mutate`;

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("405 on non-POST", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 on an unknown action", async () => {
    const res = await SELF.fetch(u(SPACE_ID), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ action: "frobnicate" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 on a non-UUID space", async () => {
    const res = await SELF.fetch(u("nope"), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ action: "create", baseId: "appX" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/internal/spaces/:id/interfaces", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/interfaces`;

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("405 on non-GET", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "PUT", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(u("not-a-uuid"), { method: "GET", headers: auth });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/internal/spaces/:id/interfaces/mutate", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/interfaces/mutate`;

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("405 on non-POST", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 on an unknown action", async () => {
    const res = await SELF.fetch(u(SPACE_ID), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ action: "explode" }),
    });
    expect(res.status).toBe(400);
  });
});
