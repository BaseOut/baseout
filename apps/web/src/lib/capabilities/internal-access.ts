/**
 * Internal/staff capability override.
 *
 * Orgs owned/administered by Openside staff (an `@openside.com` owner/admin)
 * get full (enterprise) capabilities regardless of subscription — the team can
 * exercise every paid feature against their own product without a real Stripe
 * plan. (The owner/admin scoping is enforced in resolve.ts.)
 *
 * This is a DELIBERATE exception to "gate capabilities from Stripe product
 * metadata" (Features §5.5 / CLAUDE.md §1): it is additive (it only ever
 * UPGRADES, never downgrades a real customer's tier) and keyed off our own
 * email domain, so it cannot grant access to external customers. The decision
 * is pure + tested here; the org-membership lookup that produces `internal`
 * lives in resolve.ts.
 */

import { getTierCapabilities, type Tier, type TierCapabilitySet } from './tier-capabilities'

/** Email domains treated as internal/staff. */
export const INTERNAL_EMAIL_DOMAINS = ['@openside.com'] as const

/** The tier internal orgs are granted. */
export const INTERNAL_TIER: Tier = 'enterprise'

export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return INTERNAL_EMAIL_DOMAINS.some((domain) => e.endsWith(domain))
}

export interface ResolvedCapabilities {
  tier: Tier | null
  hasSubscription: boolean
  capabilities: TierCapabilitySet
  /** True when the staff override granted full access (not a real subscription). */
  internal: boolean
}

/**
 * Layer the staff override on top of a Stripe-resolved capability set. When the
 * org is internal, return full enterprise capabilities; otherwise pass the base
 * through (tagged `internal: false`).
 */
export function applyInternalAccess(
  base: { tier: Tier | null; hasSubscription: boolean; capabilities: TierCapabilitySet },
  internal: boolean,
): ResolvedCapabilities {
  if (!internal) return { ...base, internal: false }
  return {
    tier: INTERNAL_TIER,
    hasSubscription: true,
    capabilities: getTierCapabilities(INTERNAL_TIER),
    internal: true,
  }
}
