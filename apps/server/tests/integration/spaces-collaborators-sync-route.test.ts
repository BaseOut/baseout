// Routing-layer tests for POST /api/internal/spaces/:spaceId/collaborators-sync
// (openspec/changes/server-base-collaborators). Pins the gates that resolve
// BEFORE any DB touch (the test pool's DATABASE_URL is unused):
//   - token gate (401), method gate (405), body validation (400).
// The DB-touching happy path (ingest + diff + persist) is covered by the pure
// module unit tests and the manual smoke.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const RUN_ID = "22222222-2222-2222-2222-222222222222";
const URL = `http://test/api/internal/spaces/${SPACE_ID}/collaborators-sync`;

function authed(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "x-internal-token": TEST_TOKEN, "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

describe("POST /api/internal/spaces/:spaceId/collaborators-sync — routing layer", () => {
  it("401 without the internal token", async () => {
    const res = await SELF.fetch(URL, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("405 on non-POST", async () => {
    const res = await SELF.fetch(URL, authed("GET"));
    expect(res.status).toBe(405);
  });

  it("400 when backupRunId is not a UUID", async () => {
    const res = await SELF.fetch(URL, authed("POST", { backupRunId: "nope", baseId: "app1", metadata: {} }));
    expect(res.status).toBe(400);
  });

  it("400 when baseId is missing", async () => {
    const res = await SELF.fetch(URL, authed("POST", { backupRunId: RUN_ID, metadata: {} }));
    expect(res.status).toBe(400);
  });

  it("400 when metadata is not an object", async () => {
    const res = await SELF.fetch(URL, authed("POST", { backupRunId: RUN_ID, baseId: "app1", metadata: "x" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
  });
});
