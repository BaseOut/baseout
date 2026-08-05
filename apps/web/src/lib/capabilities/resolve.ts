/**
 * DB-backed capability resolver.
 *
 * Legacy path (fallback): reads the cached `subscription_items.tier` for an org's
 * active subscription on a given platform and maps it through the static
 * tier→capability table.
 *
 * Entitlements path (DEFAULT, shared-entitlements task 2.3 cutover 2026-08-04):
 * derives the capability set from the DB-native `plan_features` catalog via
 * `resolveEntitlements` + `entitlementsToCapabilities`, the runtime source of
 * truth (pricing-guide §9.1). A caller may pass `preferEntitlements: false` to
 * force the legacy tier path. If resolution returns null (un-backfilled org) or
 * errors, it falls back to the legacy tier path, so the cutover is reversible and
 * fail-safe. The `tier` display field is unchanged either way (still the cached
 * column).
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
import { resolveEntitlements } from '../entitlements/resolve'
import { applyInternalAccess, isInternalEmail, type ResolvedCapabilities } from './internal-access'
import { entitlementsToCapabilities } from './entitlement-capabilities'
import { getTierCapabilities, type Tier, type TierCapabilitySet } from './tier-capabilities'

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

export interface ResolveCapabilitiesOptions {
  /**
   * Prefer the DB-native `plan_features` catalog (`resolveEntitlements`) over the
   * cached `subscription_items.tier` for the capability VALUES. Task 2.3 cutover
   * switch — defaults true (post-cutover 2026-08-04); pass false to force the
   * legacy tier path. Falls back to the tier path when the org has no resolvable
   * plan or resolution errors.
   */
  preferEntitlements?: boolean
}

export async function resolveCapabilities(
  db: AppDb,
  organizationId: string,
  platformSlug: string,
  opts: ResolveCapabilitiesOptions = {},
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

  // Capability VALUES: entitlements when resolvable, else the legacy tier table.
  // Task 2.3 cutover COMPLETE (2026-08-04) — entitlements are now the DEFAULT
  // source; a caller can pass preferEntitlements:false to force the legacy path.
  // Un-backfilled orgs (resolveEntitlements → null) and resolution errors still
  // fall through to the tier table, so the cutover stays fail-safe. The `tier`
  // display field below is unchanged either way.
  const preferEntitlements = opts.preferEntitlements ?? true
  let capabilities: TierCapabilitySet = getTierCapabilities(tier)
  if (preferEntitlements) {
    try {
      const resolution = await resolveEntitlements(db, organizationId)
      if (resolution) capabilities = entitlementsToCapabilities(resolution.entitlements)
    } catch {
      // Resolution/catalog-integrity failure → keep the legacy tier capabilities
      // (fail-safe cutover; the un-backfilled/null case already fell through).
    }
  }

  const base = {
    tier,
    hasSubscription: tier !== null,
    capabilities,
  }
  // Staff override (see internal-access.ts): an @openside.com-owned org gets
  // full enterprise capabilities. Additive — never downgrades a real customer.
  const internal = await orgIsInternal(db, organizationId)
  return applyInternalAccess(base, internal)
}
