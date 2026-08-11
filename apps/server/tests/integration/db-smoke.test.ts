// Smokes the per-request masterDb factory end-to-end through a route handler.
// Gated behind RUN_DB_TESTS=1 because it needs a reachable Postgres — without
// it (CI / fresh-clone contributors) the test is skipped, the suite stays
// green, and route shape is still pinned by the in-process tests below the
// gate. To run: `RUN_DB_TESTS=1 DATABASE_URL=postgres://... pnpm test`. The
// vitest.config forwards DATABASE_URL from process.env into the worker's
// bindings; without RUN_DB_TESTS the test never attempts a connection.

import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const skipIfNoDb = process.env.RUN_DB_TESTS !== "1";

describe("GET /api/internal/__db-smoke", () => {
  it("rejects without internal token (gated by middleware)", async () => {
    const res = await SELF.fetch("http://test/api/internal/__db-smoke");
    expect(res.status).toBe(401);
  });

  // The 200-path test is gated on RUN_DB_TESTS because the handler eagerly
  // opens a Postgres connection, and exercising it without a reachable DB
  // crashes the Cloudflare vitest pool (postgres-js connect rejection
  // propagates across DO isolates). Route registration is otherwise verified
  // by the smoke curl during the human checkpoint and by the typecheck.
  it.skipIf(skipIfNoDb)(
    "connects to master DB and returns { db: 'ok' }",
    async () => {
      const res = await SELF.fetch("http://test/api/internal/__db-smoke", {
        headers: { "x-internal-token": TEST_TOKEN },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      const body = (await res.json()) as { db: string };
      expect(body.db).toBe("ok");
    },
  );
});
