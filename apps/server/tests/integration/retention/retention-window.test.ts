/**
 * Pure retention-window resolver (shared-entitlements 4.4). Sources the snapshot
 * retention cap from the org's entitlements when the RETENTION_FROM_ENTITLEMENTS
 * flag is on; returns null when the feature can't be resolved so the caller falls
 * back to the legacy tier ladder.
 */

import { describe, expect, it } from "vitest";
import { retentionCapDaysFromEntitlements } from "../../../src/lib/retention/retention-window";
import type { EntitlementMap } from "@baseout/db-schema";

function limitMap(slug: string, limit: number | null): EntitlementMap {
  return {
    [slug]: {
      slug,
      valueType: "limit",
      enumValues: null,
      meterable: true,
      meterKind: "stock",
      planValue: { type: "limit", limit },
      overrideValue: null,
      addonBonus: 0,
      effective: { type: "limit", limit },
    },
  };
}

describe("retentionCapDaysFromEntitlements", () => {
  it("returns the record_history_retention_days limit (days)", () => {
    expect(
      retentionCapDaysFromEntitlements(limitMap("record_history_retention_days", 180)),
    ).toBe(180);
  });
  it("fair-use (null limit) → Infinity (keep forever)", () => {
    expect(
      retentionCapDaysFromEntitlements(limitMap("record_history_retention_days", null)),
    ).toBe(Number.POSITIVE_INFINITY);
  });
  it("feature absent → null (caller falls back to the legacy tier cap)", () => {
    expect(retentionCapDaysFromEntitlements({})).toBeNull();
  });
});
