// apiPlanFromEntitlements (api-productionization D1): the API-relevant slice of
// a resolved entitlement map, exercised through the REAL composeEntitlements
// (the shared pure rule) rather than hand-built ResolvedFeature fixtures.
import { describe, expect, it } from "vitest";
import { composeEntitlements } from "@baseout/db-schema";
import { apiPlanFromEntitlements } from "../src/lib/entitlements";

const now = new Date("2026-08-27T00:00:00Z");

const CATALOG = [
  { slug: "monthly_call_allowance", valueType: "limit" as const, meterable: true, meterKind: null },
  { slug: "api_access", valueType: "boolean" as const, meterable: false, meterKind: null },
  { slug: "mcp_access", valueType: "boolean" as const, meterable: false, meterKind: null },
  { slug: "seats", valueType: "limit" as const, meterable: false, meterKind: null },
];

function compose(planValues: { featureSlug: string; valueBool?: boolean | null; valueNumeric?: string | null; valueEnum?: string | null }[], overrides: Parameters<typeof composeEntitlements>[0]["overrides"] = []) {
  return composeEntitlements({
    features: CATALOG,
    planFeatures: planValues.map((v) => ({ valueBool: null, valueNumeric: null, valueEnum: null, ...v })),
    overrides,
    addons: [],
    now,
  });
}

describe("apiPlanFromEntitlements", () => {
  it("extracts allowance + access booleans from a plan", () => {
    const map = compose([
      { featureSlug: "monthly_call_allowance", valueNumeric: "50000" },
      { featureSlug: "api_access", valueBool: true },
      { featureSlug: "mcp_access", valueBool: false },
    ]);
    expect(apiPlanFromEntitlements("core", map)).toEqual({
      planSlug: "core",
      monthlyCallAllowance: 50000,
      apiAccess: true,
      mcpAccess: false,
    });
  });

  it("null limit (fair use) and missing features degrade safely", () => {
    const map = compose([{ featureSlug: "monthly_call_allowance", valueNumeric: null }]);
    const plan = apiPlanFromEntitlements("max", map);
    expect(plan.monthlyCallAllowance).toBeNull(); // unlimited
    expect(plan.apiAccess).toBe(false); // absent boolean → false, never throws
  });

  it("an active override on the allowance replaces the plan value", () => {
    const map = compose(
      [{ featureSlug: "monthly_call_allowance", valueNumeric: "10000" }],
      [{ featureSlug: "monthly_call_allowance", valueBool: null, valueNumeric: "250000", valueEnum: null, expiresAt: null }],
    );
    expect(apiPlanFromEntitlements("lite", map).monthlyCallAllowance).toBe(250000);
  });
});
