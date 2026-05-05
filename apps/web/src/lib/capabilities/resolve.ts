/**
 * DB-backed capability resolver. Reads the cached `subscription_items.tier`
 * for an org's active subscription on a given platform. Per Features §5.5.6
 * the canonical source is Stripe product metadata; the cached `tier` column
 * is kept in sync by Stripe webhook handlers (out of scope for this plan).
 *
 * Only subscriptions with status `active` or `trialing` resolve to their
 * tier — cancelled/past-due/incomplete subscriptions fall back to the
 * starter cap so capability gates stop honoring them immediately.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  platforms,
  subscriptionItems,
  subscriptions,
} from '../../db/schema'
import {
  getTierCapabilities,
  type Tier,
  type TierCapabilitySet,
} from './tier-capabilities'

export interface ResolvedCapabilities {
  tier: Tier | null
  hasSubscription: boolean
  capabilities: TierCapabilitySet
}

const KNOWN_TIERS: ReadonlySet<Tier> = new Set([
  'starter', 'launch', 'growth', 'pro', 'business', 'enterprise',
])

function asTier(raw: string | null | undefined): Tier | null {
  return raw && KNOWN_TIERS.has(raw as Tier) ? (raw as Tier) : null
}

export async function resolveCapabilities(
  db: AppDb,
  organizationId: string,
  platformSlug: string,
): Promise<ResolvedCapabilities> {
  const [row] = await db
    .select({ tier: subscriptionItems.tier })
    .from(subscriptionItems)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionItems.subscriptionId))
    .innerJoin(platforms, eq(platforms.id, subscriptionItems.platformId))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(platforms.slug, platformSlug),
        inArray(subscriptions.status, ['active', 'trialing']),
      ),
    )
    .limit(1)

  const tier = asTier(row?.tier)
  return {
    tier,
    hasSubscription: tier !== null,
    capabilities: getTierCapabilities(tier),
  }
}
