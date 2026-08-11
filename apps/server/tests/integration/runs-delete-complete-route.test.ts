// Routing-layer tests for POST /api/internal/runs/:runId/delete-complete.
//
// Pure DB outcome (row DELETE on ok:true, no-op on ok:false) is exercised
// at the human-checkpoint smoke step. This file pins the routing-layer
// gates only.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "33333333-3333-3333-3333-333333333333";

describe("POST /api/internal/runs/:runId/delete-complete — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/delete-complete`,
      {
        method: "POST",
        body: JSON.stringify({ runId: RUN_ID, ok: true, results: [] }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/delete-complete`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when runId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/delete-complete`,
      {
        method: "POST",
        headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
        body: JSON.stringify({ runId: "not-a-uuid", ok: true, results: [] }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on body shape mismatch (missing 'ok')", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/delete-complete`,
      {
        method: "POST",
        headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
        body: JSON.stringify({ runId: RUN_ID, results: [] }),
      },
    );
    expect(res.status).toBe(400);
  });
});
