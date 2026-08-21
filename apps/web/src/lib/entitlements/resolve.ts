/**
 * DB-backed entitlement resolver (shared-entitlements task 2.1).
 *
 * The single choke point (design D9): fetches the org's plan values, sparse
 * overrides, and active add-ons in one place and hands them to the pure
 * `composeEntitlements` from @baseout/db-schema. Web, server, and admin all
 * resolve through the same pure rule; this wrapper is the apps/web query half.
 *
 * Returns null when the org has no active/trialing subscription carrying a
 * plan_id — callers decide the fallback (e.g. treat as unsubscribed). During the
 * migration off `subscription_items.tier`, orgs get their plan_id from the
 * backfill (task 2.3); until then this returns null for un-backfilled orgs.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  accountFeatureOverrides,
  addonCatalog,
  addonPurchases,
  features,
  organizationMembers,
  planFeatures,
  plans,
  subscriptionItems,
  subscriptions,
  users,
} from '../../db/schema'
import {
  composeEntitlements,
  type EntitlementMap,
  type FeatureValueType,
  type MeterKind,
} from '@baseout/db-schema'
import { isInternalEmail } from '../capabilities/internal-access'

export interface EntitlementResolution {
  planId: string
  planSlug: string
  entitlements: EntitlementMap
}

/**
 * Internal product unlock: only owner/admin membership counts. Inviting an
 * Openside staffer as a member of a customer org must not grant that customer
 * enterprise entitlements.
 */
async function orgIsInternal(db: AppDb, organizationId: string): Promise<boolean> {
  const rows = await db
    .select({ email: users.email })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        inArray(organizationMembers.role, ['owner', 'admin']),
      ),
    )
  return rows.some((r) => isInternalEmail(r.email))
}

async function resolvePlanEntitlements(
  db: AppDb,
  planRow: { planId: string; planSlug: string },
  now: Date,
): Promise<EntitlementResolution> {
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
    .where(eq(planFeatures.planId, planRow.planId))

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
    overrides: [],
    addons: [],
    now,
  })

  return { planId: planRow.planId, planSlug: planRow.planSlug, entitlements }
}

export async function resolveEntitlements(
  db: AppDb,
  organizationId: string,
  now: Date = new Date(),
): Promise<EntitlementResolution | null> {
  if (await orgIsInternal(db, organizationId)) {
    const [enterprisePlan] = await db
      .select({ planId: plans.id, planSlug: plans.slug })
      .from(plans)
      .where(eq(plans.slug, 'enterprise'))
      .limit(1)

    if (enterprisePlan) {
      return resolvePlanEntitlements(db, enterprisePlan, now)
    }
  }

  // 1. The org's active plan — V1 has a single platform item carrying plan_id.
  const [planRow] = await db
    .select({ planId: plans.id, planSlug: plans.slug })
    .from(subscriptionItems)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionItems.subscriptionId))
    .innerJoin(plans, eq(plans.id, subscriptionItems.planId))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        inArray(subscriptions.status, ['active', 'trialing']),
      ),
    )
    .limit(1)
  if (!planRow) return null

  // 2. Plan values joined to the feature catalog (slug + type + enum ladder + meter info).
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
    .where(eq(planFeatures.planId, planRow.planId))

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
    .where(eq(accountFeatureOverrides.organizationId, organizationId))

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
    .where(eq(addonPurchases.organizationId, organizationId))

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
  })

  return { planId: planRow.planId, planSlug: planRow.planSlug, entitlements }
}
