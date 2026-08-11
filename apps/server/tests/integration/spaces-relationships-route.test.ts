// Routing-layer tests for the Relationships routes (server-relationships):
//   GET  /api/internal/spaces/:id/relationships?baseId=
//   POST /api/internal/spaces/:id/relationships/sync
//   POST /api/internal/spaces/:id/relationships/mutate
//
// Pure-DB behavior needs a provisioned managed_pg Space (no Postgres in the test
// pool), so this pins the HTTP guards: token (401), method (405), UUID + body
// validation (400).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const RUN_ID = "22222222-2222-2222-2222-222222222222";
const auth = { "x-internal-token": TEST_TOKEN, "content-type": "application/json" };

describe("GET /api/internal/spaces/:id/relationships", () => {
  const u = (s: string, b?: string) =>
    `http://test/api/internal/spaces/${s}/relationships${b ? `?baseId=${b}` : ""}`;

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID, "appX"), { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("405 on non-GET", async () => {
    const res = await SELF.fetch(u(SPACE_ID, "appX"), { method: "PUT", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(u("not-a-uuid", "appX"), { method: "GET", headers: auth });
    expect(res.status).toBe(400);
  });

  it("400 when baseId is missing", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET", headers: auth });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/internal/spaces/:id/relationships/sync", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/relationships/sync`;

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("405 on non-POST", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 on a non-UUID space", async () => {
    const res = await SELF.fetch(u("nope"), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ baseId: "appX", runId: RUN_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("400 when baseId is missing", async () => {
    const res = await SELF.fetch(u(SPACE_ID), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ runId: RUN_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("400 when runId is not a UUID", async () => {
    const res = await SELF.fetch(u(SPACE_ID), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ baseId: "appX", runId: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/internal/spaces/:id/relationships/mutate", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/relationships/mutate`;

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
      body: JSON.stringify({ action: "frobnicate", id: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
