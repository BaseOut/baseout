// Routing-layer tests for the notifications routes (server-notifications-inbox):
//   GET  /api/internal/spaces/:id/notifications
//   POST /api/internal/spaces/:id/notifications/triage
//   POST /api/internal/spaces/:id/notifications/mute
//
// Feed/persistence behavior needs a provisioned managed_pg Space (no Postgres
// in the test pool — pure derivation + triage decisions are covered in
// tests/integration/notifications/), so this pins the HTTP guards: token (401),
// method (405), UUID + body validation (400), and the done-on-state-backed
// rejection (422) — which is decided before any DB access.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const auth = { "x-internal-token": TEST_TOKEN, "content-type": "application/json" };

describe("GET /api/internal/spaces/:id/notifications", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/notifications`;

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("405 on non-GET", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "POST", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(u("not-a-uuid"), { method: "GET", headers: auth });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/internal/spaces/:id/notifications/triage", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/notifications/triage`;
  const post = (s: string, body: unknown) =>
    SELF.fetch(u(s), { method: "POST", headers: auth, body: JSON.stringify(body) });

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("405 on non-POST", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await post("nope", { itemId: "run:r1", action: "read" });
    expect(res.status).toBe(400);
  });

  it("400 on a non-JSON body", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "POST", headers: auth, body: "not json" });
    expect(res.status).toBe(400);
  });

  it("400 when itemId is missing", async () => {
    const res = await post(SPACE_ID, { action: "read" });
    expect(res.status).toBe(400);
  });

  it("400 on an unknown action", async () => {
    const res = await post(SPACE_ID, { itemId: "run:r1", action: "frobnicate" });
    expect(res.status).toBe(400);
  });

  it("400 on snooze without a valid snoozedUntil", async () => {
    const res = await post(SPACE_ID, { itemId: "run:r1", action: "snooze" });
    expect(res.status).toBe(400);
    const res2 = await post(SPACE_ID, {
      itemId: "run:r1",
      action: "snooze",
      snoozedUntil: "not-a-date",
    });
    expect(res2.status).toBe(400);
  });

  it("422 when marking a state-backed (conn:*) item done", async () => {
    const res = await post(SPACE_ID, { itemId: "conn:abc", action: "done" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("state_backed_item");
  });
});

describe("POST /api/internal/spaces/:id/notifications/mute", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/notifications/mute`;
  const post = (s: string, body: unknown) =>
    SELF.fetch(u(s), { method: "POST", headers: auth, body: JSON.stringify(body) });

  it("401 without the internal token", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("405 on non-POST", async () => {
    const res = await SELF.fetch(u(SPACE_ID), { method: "GET", headers: auth });
    expect(res.status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await post("nope", { baseId: "appX", muted: true });
    expect(res.status).toBe(400);
  });

  it("400 when baseId is missing", async () => {
    const res = await post(SPACE_ID, { muted: true });
    expect(res.status).toBe(400);
  });

  it("400 when muted is not a boolean", async () => {
    const res = await post(SPACE_ID, { baseId: "appX", muted: "yes" });
    expect(res.status).toBe(400);
  });
});
