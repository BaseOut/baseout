// TDD (CLAUDE.md §3.4) — RED first: the data-export entitlement gate decision.
//
// shared-data-portability task 1.2: a pure helper that, given the resolved
// entitlements for an org, decides entitled / unentitled, distinguishing the
// "org has no plan-carrying subscription" (resolveEntitlements → null) case
// from "the plan simply doesn't carry data_export".
//
// The catalog seed row (task 1.1) is intentionally NOT built here — it has
// concurrent uncommitted work on plan_features. This helper is written against
// the assumed slug `data_export` and is app-agnostic so apps/web and
// apps/server can both call it after their own resolveEntitlements query.

import { describe, expect, it } from "vitest";
import { composeEntitlements, type EntitlementMap } from "@baseout/db-schema";
import {
  DATA_EXPORT_FEATURE,
  decideDataExportGate,
} from "../trigger/tasks/_lib/data-export-entitlement";

// Build a realistic EntitlementMap the same way resolveEntitlements does
// (compose the pure rule from @baseout/db-schema), so the gate is exercised
// against the real ResolvedFeature shape rather than a hand-faked map.
function mapWith(dataExport: boolean | "absent"): EntitlementMap {
  const hasFeature = dataExport !== "absent";
  return composeEntitlements({
    features: [
      ...(hasFeature
        ? [{ slug: DATA_EXPORT_FEATURE, valueType: "boolean" as const }]
        : []),
      { slug: "spaces", valueType: "limit" as const },
    ],
    planFeatures: [
      ...(hasFeature
        ? [
            {
              featureSlug: DATA_EXPORT_FEATURE,
              valueBool: dataExport === true,
              valueNumeric: null,
              valueEnum: null,
            },
          ]
        : []),
      { featureSlug: "spaces", valueBool: null, valueNumeric: "10", valueEnum: null },
    ],
    now: new Date(),
  });
}

describe("decideDataExportGate", () => {
  it("is unentitled with reason no_subscription when the resolution is null", () => {
    // resolveEntitlements returns null for an org with no active/trialing,
    // plan-carrying subscription. That is NOT the same as "plan lacks the
    // feature" — callers may want to 402 vs 403 on the distinction.
    expect(decideDataExportGate(null)).toEqual({
      entitled: false,
      reason: "no_subscription",
    });
  });

  it("is entitled when the plan carries data_export = true", () => {
    expect(decideDataExportGate({ entitlements: mapWith(true) })).toEqual({
      entitled: true,
    });
  });

  it("is unentitled with reason not_entitled when data_export = false", () => {
    expect(decideDataExportGate({ entitlements: mapWith(false) })).toEqual({
      entitled: false,
      reason: "not_entitled",
    });
  });

  it("is unentitled (not a throw) when the plan does not carry data_export at all", () => {
    // getBool throws for an unresolved feature; the gate must swallow that and
    // treat an absent feature as unentitled — an older plan predating the seed
    // must not 500 the export surface.
    expect(decideDataExportGate({ entitlements: mapWith("absent") })).toEqual({
      entitled: false,
      reason: "not_entitled",
    });
  });

  it("never reads a Stripe product string — decision is purely from the entitlement map", () => {
    // Guard-rail assertion (CLAUDE.md §1): the input carries only the resolved
    // EntitlementMap. There is no plan-name / product-string parameter to read.
    const gate = decideDataExportGate({ entitlements: mapWith(true) });
    expect(gate.entitled).toBe(true);
  });
});
