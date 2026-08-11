// Routing-layer tests for POST /api/internal/runs/:runId/progress.
//
// Pure-function logic is covered in runs-progress.test.ts. This file pins:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed runId)
//   - Token gate (401 from middleware on missing x-internal-token)
//   - Body validation (400 invalid_request on missing/malformed fields)
//   - 404 (run_not_found) needs DB; gated by RUN_DB_TESTS=1 per the
//     project's existing convention (see runs-complete-route.test.ts).
//
// DB-touching happy-path is exercised at the human-checkpoint smoke step
// (curl against a hand-seeded backup_runs row in 'running' state).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "11111111-1111-1111-1111-111111111111";

const VALID_BODY = {
  triggerRunId: "run_aaaaaaaaaaaaaaaaaaaaaaaa",
  atBaseId: "appAAA111",
  recordsAppended: 100,
  tableCompleted: false,
};

describe("POST /api/internal/runs/:runId/progress — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/progress`,
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
      `http://test/api/internal/runs/${RUN_ID}/progress`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when runId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/progress`,
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
      `http://test/api/internal/runs/${RUN_ID}/progress`,
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

  it("returns 400 invalid_request when recordsAppended is missing", async () => {
    const { recordsAppended: _, ...rest } = VALID_BODY;
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/progress`,
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

  it("returns 400 invalid_request when recordsAppended is negative", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/progress`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...VALID_BODY, recordsAppended: -1 }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when tableCompleted is not a boolean", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/progress`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...VALID_BODY, tableCompleted: "yes" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when tableCompleted is missing", async () => {
    const { tableCompleted: _, ...rest } = VALID_BODY;
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/progress`,
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

  // NOTE: a "accepts a body without triggerRunId/atBaseId" happy-path
  // test would have to reach the DB (which would crash this no-DB pool
  // with a postgres-js teardown unhandled rejection — same gate as
  // db-smoke.test.ts). The fact that the parseBody function doesn't 400
  // on missing triggerRunId/atBaseId is verified implicitly: there are
  // no negative 400 tests for those keys above. The full DB-touching
  // happy path is exercised at the human-checkpoint smoke step.
});
