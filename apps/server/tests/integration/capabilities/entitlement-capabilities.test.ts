/**
 * Engine capability bridge (shared-entitlements 2.3). MIRROR of web's
 * entitlement-capabilities, collapsed to the one field the engine's
 * TierCapabilitySet carries: basesPerSpace ← bases_under_management (org-wide cap,
 * per the 2026-08-04 decision retiring the per-Space gate).
 */

import { describe, expect, it } from "vitest";
import { entitlementsToCapabilities } from "../../../src/lib/capabilities/entitlement-capabilities";
import type { EntitlementMap } from "@baseout/db-schema";

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
