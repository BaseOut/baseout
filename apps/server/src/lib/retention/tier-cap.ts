// Tier-cap resolver for the retention cleanup engine
// (openspec/changes/server-retention-and-cleanup Phase B.2).
//
// The tier-cap is the safety-net upper bound on snapshot age. decideDeletions
// deletes any run older than this cap REGARDLESS of the configured policy, so a
// Business user who writes a "keep everything" custom policy still has snapshots
// pruned at the 24-month tier ceiling. Values mirror the canonical Features §3
// "Snapshot Retention" row.
//
// `Tier` is the local mirror of apps/web's tier union
// (apps/web/src/lib/capabilities/tier-capabilities.ts). Trial is NOT a tier —
// it's a subscription status that inherits Starter gating (Features §5.5.4); a
// null tier (no active/trialing subscription item resolved) maps to the
// most-restrictive Starter cap.

export type Tier =
  | "starter"
  | "launch"
  | "growth"
  | "pro"
  | "business"
  | "enterprise";

// 30-day months for the sub-year windows; calendar years for 12mo/24mo. The
// cap is a coarse safety net — exactness isn't load-bearing.
const TIER_CAP_DAYS: Record<Tier, number> = {
  starter: 30,
  launch: 90,
  growth: 180,
  pro: 365,
  business: 730,
  enterprise: Number.POSITIVE_INFINITY,
};

export function getTierCapDays(tier: Tier | null): number {
  return tier ? TIER_CAP_DAYS[tier] : TIER_CAP_DAYS.starter;
}
