// Pure tests for the refresh-model selector (shared-oauth-refresh-keepalive).
// The mode gates whether the */15 sweep and the daily keep-alive job refresh /
// shadow / stand down — these decisions must be deterministic and safe by
// default. Placed under tests/integration/** so the server runner picks it up.

import { describe, expect, it } from "vitest";
import {
  resolveKeepaliveMode,
  sweepRefreshesInMode,
  keepaliveRefreshesInMode,
  keepaliveShadowsInMode,
} from "../../src/lib/cron/keepalive-mode";

describe("resolveKeepaliveMode", () => {
  it("defaults to 'sweep' when unset or unrecognized (safe rollback)", () => {
    expect(resolveKeepaliveMode(undefined)).toBe("sweep");
    expect(resolveKeepaliveMode("")).toBe("sweep");
    expect(resolveKeepaliveMode("SWEEP")).toBe("sweep");
    expect(resolveKeepaliveMode("garbage")).toBe("sweep");
  });

  it("recognizes the two opt-in modes exactly", () => {
    expect(resolveKeepaliveMode("shadow")).toBe("shadow");
    expect(resolveKeepaliveMode("keepalive")).toBe("keepalive");
  });
});

describe("mode gating", () => {
  it("sweep mode: */15 sweep refreshes; keep-alive is inert", () => {
    expect(sweepRefreshesInMode("sweep")).toBe(true);
    expect(keepaliveRefreshesInMode("sweep")).toBe(false);
    expect(keepaliveShadowsInMode("sweep")).toBe(false);
  });

  it("shadow mode: sweep still refreshes (safety net); keep-alive observes only", () => {
    expect(sweepRefreshesInMode("shadow")).toBe(true);
    expect(keepaliveRefreshesInMode("shadow")).toBe(false);
    expect(keepaliveShadowsInMode("shadow")).toBe(true);
  });

  it("keepalive mode: keep-alive refreshes; sweep stands down (no double-refresh)", () => {
    expect(sweepRefreshesInMode("keepalive")).toBe(false);
    expect(keepaliveRefreshesInMode("keepalive")).toBe(true);
    expect(keepaliveShadowsInMode("keepalive")).toBe(false);
  });

  it("exactly one of the two jobs ever refreshes in any mode (no overlap)", () => {
    for (const mode of ["sweep", "shadow", "keepalive"] as const) {
      const both = sweepRefreshesInMode(mode) && keepaliveRefreshesInMode(mode);
      expect(both).toBe(false);
    }
  });
});
