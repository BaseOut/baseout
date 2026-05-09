/**
 * Pure tier→capability map. Source of truth for tier limits used in the UI
 * gate. Per Features §5.5.6 the canonical source is Stripe product metadata;
 * this map mirrors that for fast in-process lookups. Keep in sync with
 * Features §4.1 (Tier Limits & Quotas).
 *
 * Currently exposes only `basesPerSpace` because that's the only gate enforced
 * by V1 UI. Add fields additively as more capability gates ship — never remove.
 */

export type Tier =
  | 'starter'
  | 'launch'
  | 'growth'
  | 'pro'
  | 'business'
  | 'enterprise'

/**
 * Backup-frequency labels per Features §6.1. Trial is mapped to starter
 * via the null-tier fallback in getTierCapabilities (Features §5.5.4 —
 * trial inherits Starter capability gating).
 */
export type Frequency = 'monthly' | 'weekly' | 'daily' | 'instant'

export interface TierCapabilitySet {
  /** Maximum Bases that can be selected for backup in a single Space. null = unlimited (Enterprise). */
  basesPerSpace: number | null
  /** Backup frequencies the user can select. Per Features §6.1. */
  frequencies: Frequency[]
}

export const TIER_CAPABILITIES: Record<Tier, TierCapabilitySet> = {
  starter:    { basesPerSpace: 5,    frequencies: ['monthly'] },
  launch:     { basesPerSpace: 10,   frequencies: ['monthly', 'weekly'] },
  growth:     { basesPerSpace: 15,   frequencies: ['monthly', 'weekly'] },
  pro:        { basesPerSpace: 25,   frequencies: ['monthly', 'weekly', 'daily'] },
  business:   { basesPerSpace: 50,   frequencies: ['monthly', 'weekly', 'daily', 'instant'] },
  enterprise: { basesPerSpace: null, frequencies: ['monthly', 'weekly', 'daily', 'instant'] },
}

/**
 * Resolve a capability set. When `tier` is null (no active subscription item
 * found for the org+platform), fall back to starter limits — the most
 * restrictive functional tier. Production orgs always have at least a $0
 * trial subscription item per Features §5.5.3, so null is rare in practice.
 */
export function getTierCapabilities(tier: Tier | null): TierCapabilitySet {
  return tier ? TIER_CAPABILITIES[tier] : TIER_CAPABILITIES.starter
}
