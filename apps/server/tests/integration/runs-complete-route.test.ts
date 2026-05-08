// Routing-layer tests for POST /api/internal/runs/:runId/complete.
//
// Pure-function logic is covered in runs-complete.test.ts. This file pins:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed runId)
//   - Token gate (401 from middleware on missing x-internal-token)
//   - Body validation (400 invalid_request on missing/malformed fields)
//
// Full DB-touching paths (with masterDb queries) are exercised at the
// human-checkpoint smoke step (curl against a hand-seeded backup_runs row),
// matching the runs-start convention.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "11111111-1111-1111-1111-111111111111";

const VALID_BODY = {
  triggerRunId: "run_aaaaaaaaaaaaaaaaaaaaaaaa",
  atBaseId: "appAAA111",
  status: "succeeded",
  tablesProcessed: 3,
  recordsProcessed: 42,
  attachmentsProcessed: 0,
};

describe("POST /api/internal/runs/:runId/complete — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when runId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify(VALID_BODY),
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 invalid_request when body is not valid JSON", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: "not json",
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 invalid_request when triggerRunId is missing", async () => {
    const { triggerRunId: _, ...rest } = VALID_BODY;
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify(rest),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when status is not one of the four allowed values", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...VALID_BODY, status: "running" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when a count field is negative", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...VALID_BODY, recordsProcessed: -1 }),
      },
    );
    expect(res.status).toBe(400);
  });
});
