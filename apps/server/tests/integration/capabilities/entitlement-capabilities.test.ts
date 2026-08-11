/**
 * Engine capability bridge (shared-entitlements 2.3). MIRROR of web's
 * entitlement-capabilities, collapsed to the one field the engine's
 * TierCapabilitySet carries: basesPerSpace ← bases_under_management (org-wide cap,
 * per the 2026-08-04 decision retiring the per-Space gate).
 */

import { describe, expect, it } from "vitest";
import {
  boolFeatureFrom,
  entitlementsToCapabilities,
} from "../../../src/lib/capabilities/entitlement-capabilities";
import type { EntitlementMap } from "@baseout/db-schema";

function boolMap(slug: string, bool: boolean): EntitlementMap {
  return {
    [slug]: {
      slug,
      valueType: "boolean",
      enumValues: null,
      meterable: false,
      meterKind: null,
      planValue: { type: "boolean", bool },
      overrideValue: null,
      addonBonus: 0,
      effective: { type: "boolean", bool },
    },
  };
}

function basesMap(limit: number | null): EntitlementMap {
  return {
    bases_under_management: {
      slug: "bases_under_management",
      valueType: "limit",
      enumValues: null,
      meterable: true,
      meterKind: "creation",
      planValue: { type: "limit", limit },
      overrideValue: null,
      addonBonus: 0,
      effective: { type: "limit", limit },
    },
  };
}

describe("entitlementsToCapabilities (engine)", () => {
  it("basesPerSpace ← bases_under_management", () => {
    expect(entitlementsToCapabilities(basesMap(50))).toEqual({ basesPerSpace: 50 });
  });
  it("fair-use (null limit) → null (unlimited)", () => {
    expect(entitlementsToCapabilities(basesMap(null))).toEqual({ basesPerSpace: null });
  });
});

describe("boolFeatureFrom (start-deps cutover)", () => {
  it("returns the boolean feature value", () => {
    expect(
      boolFeatureFrom(
        { entitlements: boolMap("automations_interfaces_backup", true) },
        "automations_interfaces_backup",
      ),
    ).toBe(true);
  });
  it("null resolution → null (caller falls back to the legacy tier gate)", () => {
    expect(boolFeatureFrom(null, "comments_backup")).toBeNull();
  });
  it("feature absent → null", () => {
    expect(boolFeatureFrom({ entitlements: {} }, "comments_backup")).toBeNull();
  });
});
