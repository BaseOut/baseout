// Routing-layer tests for GET /api/internal/spaces/:spaceId/storage-destination.
//
// Pure refresh-RPC logic is covered in refresh-drive.test.ts. This file pins
// the route shape:
//   - Method gate (only GET)
//   - URL UUID guard (400 invalid_request on malformed spaceId)
//   - Token gate (401 from middleware on missing x-internal-token)
//
// The DB-touching happy paths (fresh row → 200 with token, near-expiry →
// refresh + persist, missing row → 404) are left to the Phase 3 manual smoke
// because the route wires real Postgres + Google Drive token endpoint which
// the test pool doesn't host.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";

describe("GET /api/internal/spaces/:spaceId/storage-destination — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/storage-destination`,
      { method: "GET" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-GET methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/storage-destination`,
      {
        method: "POST",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/not-a-uuid/storage-destination`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });
});
