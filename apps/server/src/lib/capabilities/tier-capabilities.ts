// MIRROR of apps/web/src/lib/capabilities/tier-capabilities.ts
// (canonical writer). Per CLAUDE.md §5.3.
//
// Engine-side copy used by the workspace-rediscovery tier-cap resolver.
// Per Features §5.5.6 the canonical source is Stripe product metadata;
// this map mirrors that for fast in-process lookups during SpaceDO alarm
// and manual rescan, both of which are too hot a path for a Stripe round
// trip. Keep in sync with Features §4.1 (Tier Limits & Quotas) AND with
// the canonical file. Drift between the two would silently miscount the
// `basesPerSpace` cap.

export type Tier =
  | "starter"
  | "launch"
  | "growth"
  | "pro"
  | "business"
  | "enterprise";

export interface TierCapabilitySet {
  /** Maximum Bases that can be selected for backup in a single Space. null = unlimited (Enterprise). */
  basesPerSpace: number | null;
}

export const TIER_CAPABILITIES: Record<Tier, TierCapabilitySet> = {
  starter: { basesPerSpace: 5 },
  launch: { basesPerSpace: 10 },
  growth: { basesPerSpace: 15 },
  pro: { basesPerSpace: 25 },
  business: { basesPerSpace: 50 },
  enterprise: { basesPerSpace: null },
};

export function getTierCapabilities(tier: Tier | null): TierCapabilitySet {
  return tier ? TIER_CAPABILITIES[tier] : TIER_CAPABILITIES.starter;
}
