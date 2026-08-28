// Entitlement resolution for the public API (api-productionization D1).
// The apps/api query half over the SAME pure `composeEntitlements` that web,
// server, and admin use (shared-entitlements D9). Deliberately NOT ported:
// web's internal-org enterprise shortcut — the public API reports the org's
// actual subscription, so an internal org without one reads `plan: null`.

import { and, eq, inArray } from "drizzle-orm";
import {
  composeEntitlements,
  features,
  planFeatures,
  plans,
  addonCatalog,
  type EntitlementMap,
  type FeatureValueType,
  type MeterKind,
} from "@baseout/db-schema";
import type { ApiDb } from "../db/client";
import { accountFeatureOverrides, addonPurchases, subscriptionItems, subscriptions } from "../db/schema";

/** What the public API needs from the entitlement map. */
export interface ApiPlan {
  planSlug: string;
  /** Features §3 monthly call allowance; null = fair use / unlimited. */
  monthlyCallAllowance: number | null;
  apiAccess: boolean;
  mcpAccess: boolean;
}

/** Pure: extract the API-relevant values from a resolved entitlement map. */
export function apiPlanFromEntitlements(planSlug: string, entitlements: EntitlementMap): ApiPlan {
  const limit = (slug: string): number | null | undefined => {
    const f = entitlements[slug];
    return f && f.effective.type === "limit" ? f.effective.limit : undefined;
  };
  const bool = (slug: string): boolean => {
    const f = entitlements[slug];
    return f?.effective.type === "boolean" ? f.effective.bool : false;
  };
  const allowance = limit("monthly_call_allowance");
  return {
    planSlug,
    monthlyCallAllowance: allowance === undefined ? null : allowance,
    apiAccess: bool("api_access"),
    mcpAccess: bool("mcp_access"),
  };
}

/** The org's plan + API-relevant entitlements, or null (no active/trialing subscription). */
export async function resolveApiPlan(db: ApiDb, organizationId: string, now: Date): Promise<ApiPlan | null> {
  const [planRow] = await db
    .select({ planId: plans.id, planSlug: plans.slug })
    .from(subscriptionItems)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionItems.subscriptionId))
    .innerJoin(plans, eq(plans.id, subscriptionItems.planId))
    .where(and(eq(subscriptions.organizationId, organizationId), inArray(subscriptions.status, ["active", "trialing"])))
    .limit(1);
  if (!planRow) return null;

  const planFeatureRows = await db
    .select({
      slug: features.slug,
      valueType: features.valueType,
      enumValues: features.enumValues,
      meterable: features.meterable,
      meterKind: features.meterKind,
      valueBool: planFeatures.valueBool,
      valueNumeric: planFeatures.valueNumeric,
      valueEnum: planFeatures.valueEnum,
    })
    .from(planFeatures)
    .innerJoin(features, eq(features.id, planFeatures.featureId))
    .where(eq(planFeatures.planId, planRow.planId));

  const overrideRows = await db
    .select({
      featureSlug: features.slug,
      valueBool: accountFeatureOverrides.valueBool,
      valueNumeric: accountFeatureOverrides.valueNumeric,
      valueEnum: accountFeatureOverrides.valueEnum,
      expiresAt: accountFeatureOverrides.expiresAt,
    })
    .from(accountFeatureOverrides)
    .innerJoin(features, eq(features.id, accountFeatureOverrides.featureId))
    .where(eq(accountFeatureOverrides.organizationId, organizationId));

  const addonRows = await db
    .select({
      featureSlug: addonCatalog.featureSlug,
      unitQuantity: addonCatalog.unitQuantity,
      quantity: addonPurchases.quantity,
      status: addonPurchases.status,
      expiresAt: addonPurchases.expiresAt,
    })
    .from(addonPurchases)
    .innerJoin(addonCatalog, eq(addonCatalog.id, addonPurchases.addonId))
    .where(eq(addonPurchases.organizationId, organizationId));

  const entitlements = composeEntitlements({
    features: planFeatureRows.map((r) => ({
      slug: r.slug,
      valueType: r.valueType as FeatureValueType,
      enumValues: (r.enumValues as string[] | null) ?? null,
      meterable: r.meterable,
      meterKind: (r.meterKind as MeterKind | null) ?? null,
    })),
    planFeatures: planFeatureRows.map((r) => ({
      featureSlug: r.slug,
      valueBool: r.valueBool,
      valueNumeric: r.valueNumeric,
      valueEnum: r.valueEnum,
    })),
    overrides: overrideRows,
    addons: addonRows.map((r) => ({
      featureSlug: r.featureSlug,
      unitQuantity: Number(r.unitQuantity),
      quantity: r.quantity,
      status: r.status,
      expiresAt: r.expiresAt,
    })),
    now,
  });

  return apiPlanFromEntitlements(planRow.planSlug, entitlements);
}
