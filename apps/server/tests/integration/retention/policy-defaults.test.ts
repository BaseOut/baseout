// Pure-function tests for getDefaultPolicy (server-retention-and-cleanup Phase B).
//
// The engine's mirror of apps/web's per-tier retention defaults. Used by the
// cleanup pass when a Space has no backup_retention_policies row yet (a Space
// created after the one-time backfill). Policy-tier mapping is canonical per
// Features §6.9; the numeric window defaults are implementation choices the
// deferred settings UI (Phase E) will let users tune.

import { describe, expect, it } from "vitest";
import { getDefaultPolicy } from "../../../src/lib/retention/policy-defaults";

describe("getDefaultPolicy", () => {
  it("starter → basic, keepLastN 10", () => {
    expect(getDefaultPolicy("starter")).toEqual({ tier: "basic", keepLastN: 10 });
  });

  it("null (trial / no subscription) inherits starter's basic policy", () => {
    expect(getDefaultPolicy(null)).toEqual({ tier: "basic", keepLastN: 10 });
  });

  it("launch → time_based, 30-day daily window", () => {
    expect(getDefaultPolicy("launch")).toEqual({
      tier: "time_based",
      dailyWindowDays: 30,
    });
  });

  it("growth → two_tier, daily 30 / weekly 120", () => {
    expect(getDefaultPolicy("growth")).toEqual({
      tier: "two_tier",
      dailyWindowDays: 30,
      weeklyWindowDays: 120,
    });
  });

  it("pro → three_tier, daily 30 / weekly 120 / monthly indefinite", () => {
    expect(getDefaultPolicy("pro")).toEqual({
      tier: "three_tier",
      dailyWindowDays: 30,
      weeklyWindowDays: 120,
      monthlyIndefinite: true,
    });
  });

  it("business → custom with no rules (engine applies the three-tier default)", () => {
    expect(getDefaultPolicy("business")).toEqual({
      tier: "custom",
      customRules: null,
    });
  });

  it("enterprise → custom with no rules (unbounded; tier-cap is Infinity)", () => {
    expect(getDefaultPolicy("enterprise")).toEqual({
      tier: "custom",
      customRules: null,
    });
  });
});
