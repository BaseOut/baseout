// Routing-layer tests for the webhook lifecycle routes
// (server-instant-webhook Phase E):
//   POST /api/internal/spaces/:spaceId/register-webhooks
//   POST /api/internal/spaces/:spaceId/unregister-webhooks
//
// Pure lifecycle orchestration (find-or-create, cap mapping, compensating
// delete, last-unsubscribe deactivation) is covered by
// webhooks/lifecycle.test.ts. House pattern: this file pins the HTTP shape
// (401 / 405 / 400); DB + Airtable happy paths ride the smoke checklist.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE_ID = "11111111-1111-1111-1111-111111111111";

for (const action of ["register-webhooks", "unregister-webhooks"] as const) {
  describe(`POST /api/internal/spaces/:spaceId/${action} — routing layer`, () => {
    it("returns 401 without the internal token (middleware gate)", async () => {
      const res = await SELF.fetch(
        `http://test/api/internal/spaces/${SPACE_ID}/${action}`,
        { method: "POST" },
      );
      expect(res.status).toBe(401);
    });

    it("returns 405 on non-POST", async () => {
      const res = await SELF.fetch(
        `http://test/api/internal/spaces/${SPACE_ID}/${action}`,
        { method: "GET", headers: { "x-internal-token": TEST_TOKEN } },
      );
      expect(res.status).toBe(405);
    });

    it("returns 400 when spaceId is not a UUID", async () => {
      const res = await SELF.fetch(
        `http://test/api/internal/spaces/not-a-uuid/${action}`,
        { method: "POST", headers: { "x-internal-token": TEST_TOKEN } },
      );
      expect(res.status).toBe(400);
    });
  });
}
