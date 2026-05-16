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

export async function resolveCapabilities(
  db: AppDb,
  organizationId: string,
  platformSlug: string,
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
  return {
    tier,
    capabilities: getTierCapabilities(tier),
  };
}
