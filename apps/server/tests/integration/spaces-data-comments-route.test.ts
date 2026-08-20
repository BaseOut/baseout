// Routing-layer tests for GET /api/internal/spaces/:spaceId/data/comments
// (server-comments-read). Pins the gates that resolve BEFORE any DB touch (the
// test pool's DATABASE_URL is unused):
//   - token gate (401), method gate (405), spaceId + param validation (400).
// The DB-touching happy path (paged bo_at_comments read + managed_pg 501 gate)
// is covered by the pure module unit tests (comments-read.test.ts) and the
// manual smoke — mirrors spaces-collaborators-sync-route.test.ts.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const URL = `http://test/api/internal/spaces/${SPACE_ID}/data/comments`;

function authed(method: string): RequestInit {
  return { method, headers: { "x-internal-token": TEST_TOKEN } };
}

describe("GET /api/internal/spaces/:spaceId/data/comments — routing layer", () => {
  it("401 without the internal token", async () => {
    const res = await SELF.fetch(URL, { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("405 on non-GET", async () => {
    const res = await SELF.fetch(URL, authed("POST"));
    expect(res.status).toBe(405);
  });

  it("400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/not-a-uuid/data/comments`,
      authed("GET"),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { param: string }).param).toBe("spaceId");
  });

  it("400 on an unparseable cursor", async () => {
    const res = await SELF.fetch(`${URL}?cursor=not-base64!!`, authed("GET"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { param: string }).param).toBe("cursor");
  });

  it("400 on an unknown status filter", async () => {
    const res = await SELF.fetch(`${URL}?status=weird`, authed("GET"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
  });
});
