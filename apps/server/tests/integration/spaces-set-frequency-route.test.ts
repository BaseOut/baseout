// Routing-layer tests for POST /api/internal/spaces/:spaceId/set-frequency.
//
// The route is the bridge between apps/web's PATCH /backup-config and the
// per-Space SpaceDO. apps/web can't reach the DO directly across the
// service binding; this route forwards to env.SPACE_DO and writes the
// resulting next_scheduled_at to the master DB so the integrations view
// can read it without recomputing.
//
// Pure-DO behavior is covered by space-do.test.ts. This file pins the
// HTTP shape: token gate (401), method gate (405), UUID guard (400),
// body validation (400 on bad frequency).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";

describe("POST /api/internal/spaces/:spaceId/set-frequency — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/set-frequency`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frequency: "daily" }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/set-frequency`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/not-a-uuid/set-frequency`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ frequency: "daily" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/set-frequency`,
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
  });

  it("returns 400 when frequency is missing", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/set-frequency`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when frequency is unknown", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/set-frequency`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ frequency: "hourly" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when frequency='instant' (out of scope this change)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SPACE_ID}/set-frequency`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ frequency: "instant" }),
      },
    );
    expect(res.status).toBe(400);
  });
});
