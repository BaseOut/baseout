// Routing-layer tests for the Schema Docs broker routes
// (openspec/changes/shared-schema-docs §2):
//   /api/internal/spaces/:spaceId/documents            (GET, POST)
//   /api/internal/spaces/:spaceId/documents/:docId     (GET, PATCH, DELETE)
//   /api/internal/spaces/:spaceId/docs-by-entity       (GET)
//
// Pins the guards that run BEFORE any DB access: token gate (middleware),
// method gate, URL UUID guard, and the docs-by-entity query-param guard. The
// DB-touching paths (409 space_db_not_ready / 501 backend / 200 happy) are left
// to manual smoke — the engine test pool hosts no Postgres (same posture as
// spaces-storage-destination-route.test.ts).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const DOC_ID = "22222222-2222-2222-2222-222222222222";
const tok = { "x-internal-token": TEST_TOKEN } as const;

describe("Schema Docs routes — token gate", () => {
  it("documents collection → 401 without the internal token", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/documents`);
    expect(res.status).toBe(401);
  });
  it("document item → 401 without the internal token", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/documents/${DOC_ID}`);
    expect(res.status).toBe(401);
  });
  it("docs-by-entity → 401 without the internal token", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/docs-by-entity?targetType=field&targetId=fld1`,
    );
    expect(res.status).toBe(401);
  });
});

describe("Schema Docs routes — method gate", () => {
  it("documents collection → 405 on PUT", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/documents`, {
      method: "PUT",
      headers: tok,
    });
    expect(res.status).toBe(405);
  });
  it("document item → 405 on POST", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/documents/${DOC_ID}`, {
      method: "POST",
      headers: tok,
    });
    expect(res.status).toBe(405);
  });
  it("docs-by-entity → 405 on POST", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/docs-by-entity?targetType=field&targetId=fld1`,
      { method: "POST", headers: tok },
    );
    expect(res.status).toBe(405);
  });
});

describe("Schema Docs routes — request guards", () => {
  it("documents collection → 400 on a non-UUID spaceId", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/not-a-uuid/documents`, {
      headers: tok,
    });
    expect(res.status).toBe(400);
  });

  it("document item → 400 on a non-UUID documentId", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/documents/not-a-uuid`, {
      headers: tok,
    });
    expect(res.status).toBe(400);
  });

  it("documents POST → 400 when title is missing", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/documents`, {
      method: "POST",
      headers: { ...tok, "content-type": "application/json" },
      body: JSON.stringify({ body: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("docs-by-entity → 400 on an invalid targetType", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/docs-by-entity?targetType=widget&targetId=x`,
      { headers: tok },
    );
    expect(res.status).toBe(400);
  });

  it("docs-by-entity → 400 when targetId is missing", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/docs-by-entity?targetType=field`,
      { headers: tok },
    );
    expect(res.status).toBe(400);
  });
});

describe("Schema read route — guards", () => {
  it("schema → 401 without the internal token", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/schema`);
    expect(res.status).toBe(401);
  });
  it("schema → 405 on POST", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SPACE_ID}/schema`, {
      method: "POST",
      headers: tok,
    });
    expect(res.status).toBe(405);
  });
  it("schema → 400 on a non-UUID spaceId", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/not-a-uuid/schema`, {
      headers: tok,
    });
    expect(res.status).toBe(400);
  });
});
