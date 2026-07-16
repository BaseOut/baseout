// Pure tests for dead-connection auto-invalidation (Phase 4 of
// shared-oauth-refresh-keepalive). The real UPDATE is integration
// (RUN_DB_TESTS); here we pin the grace-cutoff decision + observability.

import { describe, expect, it, vi } from "vitest";
import {
  runConnectionAutoInvalidate,
  PENDING_REAUTH_GRACE_MS,
} from "../../src/lib/connections/auto-invalidate";

const NOW = new Date("2026-07-16T12:00:00.000Z");

describe("runConnectionAutoInvalidate", () => {
  it("invalidates stale connections using a now-minus-grace cutoff and logs the count", async () => {
    const invalidateStale = vi.fn(async () => 3);
    const log = vi.fn();

    const result = await runConnectionAutoInvalidate({
      now: () => NOW,
      invalidateStale,
      log,
    });

    expect(result).toEqual({ invalidated: 3 });
    expect(invalidateStale).toHaveBeenCalledWith(
      new Date(NOW.getTime() - PENDING_REAUTH_GRACE_MS),
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "connection_auto_invalidate", invalidated: 3 }),
    );
  });

  it("uses the ~10-day grace window from PRD §11 Q5", () => {
    expect(PENDING_REAUTH_GRACE_MS).toBe(10 * 24 * 60 * 60 * 1000);
  });

  it("logs an observable zero when nothing is past grace", async () => {
    const log = vi.fn();
    const result = await runConnectionAutoInvalidate({
      now: () => NOW,
      invalidateStale: async () => 0,
      log,
    });
    expect(result).toEqual({ invalidated: 0 });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ invalidated: 0 }));
  });
});
