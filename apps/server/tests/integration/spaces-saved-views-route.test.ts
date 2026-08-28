// Routing-layer tests for the saved-views broker routes (server-saved-views):
//   /api/internal/spaces/:spaceId/views            (GET, POST)
//   /api/internal/spaces/:spaceId/views/:viewId    (GET, PATCH, DELETE)
//
// Pins the guards that run BEFORE any DB access: token gate (middleware),
// method gate, URL UUID guard, and body validation incl. the table_locked
// invariant. DB-touching paths ride the api-views-tools local smoke — the
// engine test pool hosts no Postgres (spaces-documents-route.test.ts posture).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const VIEW_ID = "33333333-3333-3333-3333-333333333333";
const tok = { "x-internal-token": TEST_TOKEN } as const;
const jsonTok = { ...tok, "content-type": "application/json" } as const;
const COLLECTION = `http://test/api/internal/spaces/${SPACE_ID}/views`;
const ITEM = `${COLLECTION}/${VIEW_ID}`;

describe("Saved-views routes — token gate", () => {
  it("collection + item → 401 without the internal token", async () => {
    expect((await SELF.fetch(COLLECTION)).status).toBe(401);
    expect((await SELF.fetch(ITEM)).status).toBe(401);
  });
});

describe("Saved-views routes — method gate", () => {
  it("collection → 405 on PATCH; item → 405 on POST", async () => {
    expect((await SELF.fetch(COLLECTION, { method: "PATCH", headers: tok })).status).toBe(405);
    expect((await SELF.fetch(ITEM, { method: "POST", headers: tok })).status).toBe(405);
  });
});

describe("Saved-views routes — validation guards", () => {
  it("400 on a non-UUID space or view id", async () => {
    expect((await SELF.fetch(`http://test/api/internal/spaces/nope/views`, { headers: tok })).status).toBe(400);
    expect((await SELF.fetch(`${COLLECTION}/nope`, { headers: tok })).status).toBe(400);
  });

  it("POST → 400 on a create body missing name/tableId/config", async () => {
    const res = await SELF.fetch(COLLECTION, { method: "POST", headers: jsonTok, body: JSON.stringify({ name: "x" }) });
    expect(res.status).toBe(400);
  });

  it("PATCH with a tableId key → 400 table_locked (the Save-locks-table invariant)", async () => {
    const res = await SELF.fetch(ITEM, { method: "PATCH", headers: jsonTok, body: JSON.stringify({ tableId: "tbl1" }) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error).toBe("table_locked");
  });

  it("PATCH with an empty body → 400 invalid_request", async () => {
    const res = await SELF.fetch(ITEM, { method: "PATCH", headers: jsonTok, body: "{}" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error).toBe("invalid_request");
  });
});
