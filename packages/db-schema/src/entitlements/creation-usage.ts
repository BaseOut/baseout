/**
 * Creation-cap read path — pure, no I/O (shared-entitlements task 3.4).
 *
 * Creation-class meters (design D3, `meter_kind = 'creation'`: Spaces, bases,
 * seats, external destinations, active reports, documents) are NOT rolled up into
 * `usage_rollups` — they're a live `COUNT(*)` resolved on read. This module is the
 * pure half: given the org's resolved entitlements and the current live counts, it
 * produces a per-feature usage summary (for the visibility endpoints, task 9.1) and
 * answers the one-more-slot question the create-time gate asks (task 4.3).
 *
 * Pure: same inputs → same output. The `COUNT(*)` queries live in the per-app
 * wiring that calls this. Only `meter_kind = 'creation'` limit features appear in
 * the summary — passing the full entitlement map is fine; everything else is
 * skipped, mirroring `evaluateUsage`.
 */

import type { EntitlementMap } from './resolve'

/** One creation-class feature's live usage against its effective cap. */
export interface CreationUsage {
  featureSlug: string
  /** Live count of existing items. */
  used: number
  /** Effective cap; `null` = fair use / unlimited. */
  limit: number | null
  /** Slots left; `null` when unlimited, else `max(0, limit - used)`. */
  remaining: number | null
  /** `used <= limit`; fair use is always within. */
  withinLimit: boolean
  /** `used / limit`, for the visibility payload. `0` unlimited; `Infinity` at a 0 cap with usage. */
  pct: number
}

export interface CreationUsageInput {
  /** Resolved effective entitlements for the org (from resolveEntitlements). */
  entitlements: EntitlementMap
  /** Live `COUNT(*)` per creation-class feature slug; a missing slug defaults to 0. */
  counts: Record<string, number>
}

/** Fraction of the cap consumed. Unlimited → 0; zero cap with usage → ∞. */
function usageFraction(used: number, limit: number): number {
  if (limit > 0) return used / limit
  return used > 0 ? Number.POSITIVE_INFINITY : 0
}

/**
 * Summarize live creation-cap usage for every creation-class limit feature in the
 * map, sorted by slug for a deterministic payload. See module doc.
 */
export function summarizeCreationUsage(input: CreationUsageInput): CreationUsage[] {
  const out: CreationUsage[] = []

  for (const feature of Object.values(input.entitlements)) {
    if (feature.meterKind !== 'creation' || feature.effective.type !== 'limit') continue

    const limit = feature.effective.limit // number | null (null = fair use)
    const used = input.counts[feature.slug] ?? 0

    out.push({
      featureSlug: feature.slug,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      withinLimit: limit === null || used <= limit,
      pct: limit === null ? 0 : usageFraction(used, limit),
    })
  }

  return out.sort((a, b) => a.featureSlug.localeCompare(b.featureSlug))
}

/**
 * Is there room to create one more of `slug`? Allowed strictly under the cap
 * (`used < limit`); blocked at or over it. Fair use always allows. Fails OPEN when
 * the feature is not a resolved limit (absent from the plan or wrong type) — a
 * create gate must not block on a resolution gap.
 */
export function canCreate(
  entitlements: EntitlementMap,
  slug: string,
  currentCount: number,
): boolean {
  const feature = entitlements[slug]
  if (!feature || feature.effective.type !== 'limit') return true
  const limit = feature.effective.limit
  return limit === null || currentCount < limit
}
