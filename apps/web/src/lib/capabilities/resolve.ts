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
  organizationMembers,
  platforms,
  subscriptionItems,
  subscriptions,
  users,
} from '../../db/schema'
import { applyInternalAccess, isInternalEmail, type ResolvedCapabilities } from './internal-access'
import { getTierCapabilities, type Tier } from './tier-capabilities'

export type { ResolvedCapabilities } from './internal-access'

const KNOWN_TIERS: ReadonlySet<Tier> = new Set([
  'starter', 'launch', 'growth', 'pro', 'business', 'enterprise',
])

function asTier(raw: string | null | undefined): Tier | null {
  return raw && KNOWN_TIERS.has(raw as Tier) ? (raw as Tier) : null
}

/**
 * Is this org owned/administered by internal (@openside.com) staff? → full
 * access. Scoped to owner/admin (not any member) so that inviting a staffer
 * into an external customer's org can't silently grant that customer enterprise.
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
  const base = {
    tier,
    hasSubscription: tier !== null,
    capabilities: getTierCapabilities(tier),
  }
  // Staff override (see internal-access.ts): an @openside.com-owned org gets
  // full enterprise capabilities. Additive — never downgrades a real customer.
  const internal = await orgIsInternal(db, organizationId)
  return applyInternalAccess(base, internal)
}
