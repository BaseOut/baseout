// MIRROR of apps/web/src/lib/capabilities/resolve.ts (canonical writer).
// Per CLAUDE.md §5.3.
//
// Resolves the cached `subscription_items.tier` for an Org's active
// Airtable subscription. Used by workspace rediscovery to determine
// whether newly-discovered bases can be auto-included (vs. blocked by
// the tier `basesPerSpace` cap).
//
// Per Features §5.5.6, Stripe product metadata is canonical; the cached
// tier column is kept in sync by Stripe webhook handlers in apps/web.
// Only 'active' and 'trialing' subscriptions resolve to their tier —
// cancelled/past_due/incomplete subscriptions fall back to the starter
// cap so capability gates stop honoring them immediately.

import { and, eq, inArray } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import {
  platforms,
  subscriptionItems,
  subscriptions,
} from "../../db/schema";
import { resolveEntitlements } from "../entitlements/resolve";
import { entitlementsToCapabilities } from "./entitlement-capabilities";
import {
  getTierCapabilities,
  type Tier,
  type TierCapabilitySet,
} from "./tier-capabilities";

const KNOWN_TIERS: ReadonlySet<Tier> = new Set([
  "starter",
  "launch",
  "growth",
  "pro",
  "business",
  "enterprise",
]);

function asTier(raw: string | null | undefined): Tier | null {
  return raw && KNOWN_TIERS.has(raw as Tier) ? (raw as Tier) : null;
}

export interface ResolvedCapabilities {
  tier: Tier | null;
  capabilities: TierCapabilitySet;
}

export interface ResolveCapabilitiesOptions {
  /**
   * Prefer the DB-native `plan_features` catalog (`resolveEntitlements`) over the
   * cached `subscription_items.tier` for the capability VALUES (shared-entitlements
   * task 2.3 cutover). Defaults true — mirrors apps/web's post-cutover default.
   * Falls back to the legacy tier table when the org has no resolvable plan or
   * resolution errors, so the cutover is reversible and fail-safe. The `tier`
   * display field is unchanged either way (still the cached column).
   */
  preferEntitlements?: boolean;
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
    .innerJoin(
      subscriptions,
      eq(subscriptions.id, subscriptionItems.subscriptionId),
    )
    .innerJoin(platforms, eq(platforms.id, subscriptionItems.platformId))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(platforms.slug, platformSlug),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .limit(1);

  const tier = asTier(row?.tier);

  // Capability VALUES: entitlements when resolvable (task 2.3 default), else the
  // legacy tier table. Un-backfilled orgs (null resolution) and resolution errors
  // fall through to the tier table, so the cutover stays fail-safe. The `tier`
  // display field is unchanged either way.
  const preferEntitlements = opts.preferEntitlements ?? true;
  let capabilities: TierCapabilitySet = getTierCapabilities(tier);
  if (preferEntitlements) {
    try {
      const resolution = await resolveEntitlements(db, organizationId);
      if (resolution) {
        capabilities = entitlementsToCapabilities(resolution.entitlements);
      }
    } catch {
      // Catalog-integrity failure → keep the legacy tier capabilities.
    }
  }

  return { tier, capabilities };
}
