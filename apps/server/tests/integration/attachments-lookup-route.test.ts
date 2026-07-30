// Routing-layer tests for the attachment dedup endpoints
// (openspec/changes/server-attachments):
//   POST /api/internal/attachments/lookup
//   POST /api/internal/attachments/record
//
// Pins the route shape:
//   - Token gate (401 from middleware on missing x-internal-token)
//   - Method gate (only POST → 405 otherwise)
//   - Body validation (400 invalid_request on bad/missing spaceId or batch)
//   - Empty-batch fast paths return 200 WITHOUT touching Postgres (the test
//     pool hosts no DB).
//
// The DB-touching happy paths (real hit/miss reads + upserts) are left to the
// manual smoke, matching spaces-storage-destination-route.test.ts — the test
// pool's DATABASE_URL points at an unused database.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";

function authed(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      "x-internal-token": TEST_TOKEN,
      "content-type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

describe("POST /api/internal/attachments/lookup — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch("http://test/api/internal/attachments/lookup", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/lookup",
      authed("GET"),
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/lookup",
      authed("POST", { spaceId: "not-a-uuid", compositeIds: ["a"] }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid_request",
    );
  });

  it("returns 400 invalid_request when compositeIds is missing", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/lookup",
      authed("POST", { spaceId: SPACE_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 {hits:{}} for an empty compositeIds batch (no DB)", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/lookup",
      authed("POST", { spaceId: SPACE_ID, compositeIds: [] }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { hits: Record<string, string> }).toEqual({
      hits: {},
    });
  });

  // server-comment-attachments Decision 4: source:'comment' branch.
  it("returns 400 invalid_request on an unknown source", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/lookup",
      authed("POST", { spaceId: SPACE_ID, source: "bogus", keys: ["com1:att1"] }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
  });

  it("returns 200 {hits:{}} for an empty comment keys batch (no DB)", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/lookup",
      authed("POST", { spaceId: SPACE_ID, source: "comment", keys: [] }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { hits: Record<string, string> }).toEqual({ hits: {} });
  });

  it("returns 400 when source:'comment' but keys is missing", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/lookup",
      authed("POST", { spaceId: SPACE_ID, source: "comment" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/internal/attachments/record — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch("http://test/api/internal/attachments/record", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/record",
      authed("GET"),
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when an entry is missing storageKey", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/record",
      authed("POST", {
        spaceId: SPACE_ID,
        entries: [{ compositeId: "b1_t1_r1_f1_a1" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when uploadStatus is not ready|uploaded", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/record",
      authed("POST", {
        spaceId: SPACE_ID,
        entries: [
          {
            compositeId: "b1_t1_r1_f1_a1",
            storageKey: "k1",
            uploadStatus: "bogus",
          },
        ],
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid_request",
    );
  });

  it("returns 200 {recorded:0} for an empty entries batch (no DB)", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/record",
      authed("POST", { spaceId: SPACE_ID, entries: [] }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { recorded: number }).toEqual({ recorded: 0 });
  });

  // server-comment-attachments Decision 4: source:'comment' branch.
  it("returns 400 when a comment entry has a malformed commentAttachmentId", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/record",
      authed("POST", {
        spaceId: SPACE_ID,
        source: "comment",
        entries: [{ commentAttachmentId: "nocolon", storageKey: "k1" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when a comment entry is missing storageKey", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/record",
      authed("POST", {
        spaceId: SPACE_ID,
        source: "comment",
        entries: [{ commentAttachmentId: "com1:att1" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 {recorded:0} for an empty comment entries batch (no DB)", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/attachments/record",
      authed("POST", { spaceId: SPACE_ID, source: "comment", entries: [] }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { recorded: number }).toEqual({ recorded: 0 });
  });
});
