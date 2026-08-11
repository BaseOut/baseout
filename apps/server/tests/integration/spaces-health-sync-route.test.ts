// Routing-layer tests for POST /api/internal/spaces/:spaceId/health-sync.
//
// The workflows health-score-base task POSTs per-metric scores + findings here;
// the engine writes them to the per-Space result tables. Pure-DB behavior needs
// a provisioned managed_pg Space (no Postgres in the test pool), so this file
// pins only the HTTP guards: token (401), method (405), UUID + body (400).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const RUN_ID = "22222222-2222-2222-2222-222222222222";

function url(spaceId: string): string {
  return `http://test/api/internal/spaces/${spaceId}/health-sync`;
}

const validBody = JSON.stringify({
  baseId: "appXYZ",
  runId: RUN_ID,
  metrics: [{ ruleId: "r1", score: 80, findings: [] }],
});

describe("POST /api/internal/spaces/:spaceId/health-sync — routing layer", () => {
  it("returns 401 without the internal token", async () => {
    const res = await SELF.fetch(url(SPACE_ID), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: validBody,
    });
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST", async () => {
    const res = await SELF.fetch(url(SPACE_ID), {
      method: "GET",
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(405);
  });

  it("returns 400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(url("not-a-uuid"), {
      method: "POST",
      headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
      body: validBody,
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await SELF.fetch(url(SPACE_ID), {
      method: "POST",
      headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when baseId is missing", async () => {
    const res = await SELF.fetch(url(SPACE_ID), {
      method: "POST",
      headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ runId: RUN_ID, metrics: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when runId is not a UUID", async () => {
    const res = await SELF.fetch(url(SPACE_ID), {
      method: "POST",
      headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ baseId: "appXYZ", runId: "nope", metrics: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when metrics is not an array", async () => {
    const res = await SELF.fetch(url(SPACE_ID), {
      method: "POST",
      headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ baseId: "appXYZ", runId: RUN_ID, metrics: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
