// Routing-layer tests for POST /api/internal/spaces/:spaceId/rescan-bases.
//
// Pure-function rediscovery logic is covered in rediscovery-run.test.ts.
// This file pins the route shape:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed spaceId)
//   - Token gate (401 from middleware on missing x-internal-token)
//
// The full DB-touching happy path is left to the Phase 3 manual smoke
// (curl against a hand-seeded backup_configurations row + a real
// Airtable workspace) because the route wires real Postgres deps that
// the test pool doesn't currently host.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";

describe("POST /api/internal/spaces/:spaceId/rescan-bases — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/rescan-bases`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/rescan-bases`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/not-a-uuid/rescan-bases`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: "{}",
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });
});
