// Routing-layer tests for POST /api/internal/restores/:restoreId/start
// (server-restore Phase B.3).
//
// Mirrors runs-start-route.test.ts exactly. Pure-function logic is covered
// in restores-start.test.ts. This file pins:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed restoreId)
//   - Token gate (401 from middleware on missing x-internal-token)

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RESTORE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("POST /api/internal/restores/:restoreId/start — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/restores/${RESTORE_ID}/start`,
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
      `http://test/api/internal/restores/${RESTORE_ID}/start`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when restoreId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/restores/not-a-uuid/start`,
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
