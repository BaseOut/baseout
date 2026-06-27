// Routing-layer tests for GET /api/internal/runs/:runId/detail
// (openspec/changes/server-run-detail)
//
// This endpoint returns the per-base/per-table snapshot for a run. It assembles
// backup_run_bases + backup_run_tables rows for the given runId.
//
// Tests cover the routing layer only (matching the pattern in
// runs-complete-route.test.ts — DB-touching paths are human-smoked via curl):
//   - 401 without internal token (middleware gate)
//   - 405 on non-GET methods
//   - 400 invalid_request on malformed runId
//
// Human smoke (200 with empty bases + 200 with real rows):
//   curl -s -H "x-internal-token: <TOKEN>" \
//        "https://baseout-server-dev.<account>.workers.dev/api/internal/runs/<runId>/detail"
//   Expect: { "bases": [] } when no per-table detail exists.
//   Expect: { "bases": [{ atBaseId, baseName, ..., tables: [...] }] } after a
//   completion that included tables[] (once workflows-run-detail lands).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "11111111-1111-1111-1111-111111111111";

describe("GET /api/internal/runs/:runId/detail — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/detail`,
      { method: "GET" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-GET methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/detail`,
      {
        method: "POST",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when runId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/detail`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });
});
