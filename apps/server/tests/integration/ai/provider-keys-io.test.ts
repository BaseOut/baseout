/**
 * Pure decision test for the AI-routing entitlement dep (shared-ai-byok 3.1).
 * The DB wrappers (isByokEntitled/findActiveKey) are thin glue verified by
 * typecheck; byokEntitledFrom carries the fail-closed logic, tested here.
 */

import { describe, expect, it } from "vitest";
import { byokEntitledFrom } from "../../../src/lib/ai/provider-keys-io";
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

describe("byokEntitledFrom", () => {
  it("null resolution (no active plan) → false", () => {
    expect(byokEntitledFrom(null)).toBe(false);
  });
  it("byo_ai_key = true → true", () => {
    expect(byokEntitledFrom({ entitlements: boolMap("byo_ai_key", true) })).toBe(true);
  });
  it("byo_ai_key = false → false", () => {
    expect(byokEntitledFrom({ entitlements: boolMap("byo_ai_key", false) })).toBe(false);
  });
  it("feature absent from the plan → false (fail closed, no throw)", () => {
    expect(byokEntitledFrom({ entitlements: {} })).toBe(false);
  });
});
