/**
 * Legacy tier → new plan-slug mapping (shared-entitlements task 2.3).
 *
 * The old model's `subscription_items.tier` text (starter/launch/growth/pro/
 * business/enterprise + trial) maps onto the new plan slugs. Alignment is by
 * price point, which is exact for the four public tiers:
 *   launch  $49  → lite  $49
 *   growth  $99  → core  $99
 *   pro     $199 → plus  $199
 *   business $399 → max  $399
 * `starter` ($29, retired hidden plan) has no new equivalent → nearest paid = lite.
 * `trial` → trial; `enterprise` → enterprise.
 *
 * Used by the plan_id backfill script; returns null for an unknown tier so the
 * backfill can skip + report rather than mis-assign.
 */

export const LEGACY_TIER_TO_PLAN_SLUG: Record<string, string> = {
  trial: 'trial',
  starter: 'lite',
  launch: 'lite',
  growth: 'core',
  pro: 'plus',
  business: 'max',
  enterprise: 'enterprise',
}

export function legacyTierToPlanSlug(tier: string | null | undefined): string | null {
  if (!tier) return null
  return LEGACY_TIER_TO_PLAN_SLUG[tier] ?? null
}
