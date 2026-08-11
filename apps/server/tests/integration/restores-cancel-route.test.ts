// Routing-layer tests for POST /api/internal/restores/:restoreId/cancel
// (server-restore Phase D.2).
//
// Mirrors runs-cancel-route.test.ts for the restore lifecycle. Pure-function
// logic is covered in restores-cancel.test.ts. This file pins:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed restoreId)
//   - Token gate (401 from middleware on missing x-internal-token)
//
// DB-touching success/failure paths (200 / 404 / 409 with real masterDb
// state) are exercised at the human-checkpoint smoke step.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RESTORE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("POST /api/internal/restores/:restoreId/cancel — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/restores/${RESTORE_ID}/cancel`,
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/restores/${RESTORE_ID}/cancel`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 405 on PUT", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/restores/${RESTORE_ID}/cancel`,
      {
        method: "PUT",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when restoreId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/restores/not-a-uuid/cancel`,
      {
        method: "POST",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });
});
