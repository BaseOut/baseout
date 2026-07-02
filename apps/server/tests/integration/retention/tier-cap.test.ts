// Pure-function tests for getTierCapDays (server-retention-and-cleanup Phase B.2).
//
// The tier-cap is the safety-net upper bound on snapshot age, enforced by
// decideDeletions regardless of the configured policy. Values mirror the
// canonical Features §3 "Snapshot Retention" row: Trial/Starter 30d, Launch
// 90d, Growth 6mo, Pro 12mo, Business 24mo, Enterprise custom (unbounded).

import { describe, expect, it } from "vitest";
import { getTierCapDays } from "../../../src/lib/retention/tier-cap";

describe("getTierCapDays", () => {
  it("caps starter at 30 days", () => {
    expect(getTierCapDays("starter")).toBe(30);
  });

  it("caps launch at 90 days", () => {
    expect(getTierCapDays("launch")).toBe(90);
  });

  it("caps growth at 180 days (6 months)", () => {
    expect(getTierCapDays("growth")).toBe(180);
  });

  it("caps pro at 365 days (12 months)", () => {
    expect(getTierCapDays("pro")).toBe(365);
  });

  it("caps business at 730 days (24 months)", () => {
    expect(getTierCapDays("business")).toBe(730);
  });

  it("leaves enterprise unbounded (Infinity)", () => {
    expect(getTierCapDays("enterprise")).toBe(Number.POSITIVE_INFINITY);
  });

  it("falls back to the starter cap (30d) for a null tier (trial / no subscription)", () => {
    // Trial inherits Starter gating (Features §5.5.4); a null tier means no
    // active subscription item resolved. Both map to the most restrictive cap.
    expect(getTierCapDays(null)).toBe(30);
  });
});
