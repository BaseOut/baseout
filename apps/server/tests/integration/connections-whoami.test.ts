// Routing-layer tests for POST /api/internal/connections/:id/whoami.
//
// These cases all assert paths BEFORE any DB query — the workerd test pool
// has no real Postgres, and DB-touching cases are gated behind RUN_DB_TESTS=1.
// The two cases below cover:
//   - middleware: missing x-internal-token → 401
//   - handler:    invalid uuid in path     → 400 invalid_connection_id
//
// TODO(integration, RUN_DB_TESTS=1): Add cases that actually hit a DB:
//   - 404 when the connection_id is well-formed but absent
//   - 409 when the row exists with status='pending_reauth' or similar
//   - 200 happy path with msw-mocked Airtable + a seeded row
// Skip via `it.skipIf(!process.env.RUN_DB_TESTS)` once a test DB is available.

import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("POST /api/internal/connections/:id/whoami — routing", () => {
  it("rejects requests without x-internal-token (401)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/connections/${VALID_UUID}/whoami`,
      { method: "POST" },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 invalid_connection_id when :id is not a UUID", async () => {
    const res = await SELF.fetch(
      "http://test/api/internal/connections/not-a-uuid/whoami",
      {
        method: "POST",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_connection_id");
  });

  it("returns 404 from the not-found fallthrough on GET (only POST is routed)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/connections/${VALID_UUID}/whoami`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(404);
  });
});
