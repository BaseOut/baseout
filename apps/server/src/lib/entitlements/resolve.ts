/**
 * DB-backed entitlement resolver — engine half (shared-entitlements task 2.1/4.2).
 *
 * The server's query wrapper around the pure `composeEntitlements` from
 * @baseout/db-schema — the same single deterministic rule web and admin resolve
 * through (design D9). Used at usage-enforcement time to get each meterable
 * feature's effective limit (plan value ± override + add-ons).
 *
 * The PURE catalog tables (plans, features, plan_features, addon_catalog) have no
 * app-table FKs and are imported straight from @baseout/db-schema; the
 * account-scoped tables (subscriptions, subscription_items, overrides, add-on
 * purchases) are the engine's read-only mirrors under ../../db/schema.
 *
 * Returns null when the org has no active/trialing subscription carrying a
 * plan_id (un-backfilled orgs included, per task 2.3) — the caller treats a null
 * resolution as "nothing to enforce" and skips.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import {
  accountFeatureOverrides,
  addonPurchases,
  subscriptionItems,
  subscriptions,
} from "../../db/schema";
import {
  addonCatalog,
  composeEntitlements,
  features,
  planFeatures,
  plans,
  type EntitlementMap,
  type FeatureValueType,
  type MeterKind,
} from "@baseout/db-schema";

export interface EntitlementResolution {
  planId: string;
  planSlug: string;
  entitlements: EntitlementMap;
}

export async function resolveEntitlements(
  db: AppDb,
  organizationId: string,
  now: Date = new Date(),
): Promise<EntitlementResolution | null> {
  // 1. The org's active plan — V1 has a single platform item carrying plan_id.
  const [planRow] = await db
    .select({ planId: plans.id, planSlug: plans.slug })
    .from(subscriptionItems)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionItems.subscriptionId))
    .innerJoin(plans, eq(plans.id, subscriptionItems.planId))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .limit(1);
  if (!planRow) return null;

  // 2. Plan values joined to the feature catalog (slug + type + enum + meter info).
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

  // 3. Sparse per-account overrides.
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

  // 4. Add-on purchases joined to the catalog; composeEntitlements filters active.
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
    overrides: overrideRows.map((r) => ({
      featureSlug: r.featureSlug,
      valueBool: r.valueBool,
      valueNumeric: r.valueNumeric,
      valueEnum: r.valueEnum,
      expiresAt: r.expiresAt,
    })),
    addons: addonRows.map((r) => ({
      featureSlug: r.featureSlug,
      unitQuantity: Number(r.unitQuantity),
      quantity: r.quantity,
      status: r.status,
      expiresAt: r.expiresAt,
    })),
    now,
  });

  return { planId: planRow.planId, planSlug: planRow.planSlug, entitlements };
}
