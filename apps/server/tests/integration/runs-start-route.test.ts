// Routing-layer tests for POST /api/internal/runs/:runId/start.
//
// Pure-function logic is covered in runs-start.test.ts. This file pins:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed runId)
//   - Token gate (401 from middleware on missing x-internal-token)
//
// Result-code → HTTP-status mapping is also covered here against a
// hand-crafted DB stub via processRunStart's dep injection. The full DB-
// touching happy path (with masterDb queries) is left to plan task 8.6
// (curl smoke against a hand-seeded backup_runs row).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "11111111-1111-1111-1111-111111111111";

describe("POST /api/internal/runs/:runId/start — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/start`,
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
      `http://test/api/internal/runs/${RUN_ID}/start`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when runId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/start`,
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
