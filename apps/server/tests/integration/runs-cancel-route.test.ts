// Routing-layer tests for POST /api/internal/runs/:runId/cancel.
//
// Pure-function logic is covered in runs-cancel.test.ts. This file pins:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed runId)
//   - Token gate (401 from middleware on missing x-internal-token)
//
// DB-touching success/failure paths (200 / 404 / 409 with real masterDb
// state) are exercised at the human-checkpoint smoke step, matching the
// runs-start / runs-complete convention.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "22222222-2222-2222-2222-222222222222";

describe("POST /api/internal/runs/:runId/cancel — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/cancel`,
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/cancel`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 405 on PUT", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/cancel`,
      {
        method: "PUT",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when runId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/cancel`,
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
