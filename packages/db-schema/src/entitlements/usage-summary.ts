/**
 * Usage summary assembler — pure, no I/O (shared-entitlements task 9.1).
 *
 * The read model behind the usage/limits endpoint: given the org's resolved
 * entitlements, live creation counts, and current-period rollup usage, it produces
 * one unified `UsageMeter` per metered limit feature. Stock/flow meters read from
 * `rollups` (absent → 0, i.e. measured-but-idle). Creation meters read from
 * `creationCounts`; a creation meter not present there is `used: null` — "not
 * measured in this scope" (e.g. documents/reports live in the per-Space DB, out of
 * reach of a web endpoint) — rather than a misleading 0.
 *
 * Only metered limit features appear; boolean/enum gates and non-meterable limits
 * are skipped, mirroring `evaluateUsage` / `summarizeCreationUsage`. Pure: same
 * inputs → same output; the DB reads live in the per-app route wiring.
 */

import type { EntitlementMap } from './resolve'
import type { MeterKind } from './values'

export interface UsageMeter {
  featureSlug: string
  meterKind: MeterKind
  /** Live level; `null` when this meter isn't measured in the caller's scope. */
  used: number | null
  /** Effective cap; `null` = fair use / unlimited. */
  limit: number | null
  /** Slots/headroom left; `null` when unlimited or unmeasured, else `max(0, limit - used)`. */
  remaining: number | null
  /** `used <= limit`; unmeasured and fair-use are treated as within (never false-flag). */
  withinLimit: boolean
  /** `used / limit` for the payload; `0` unlimited/unmeasured; `Infinity` at a 0 cap with usage. */
  pct: number
}

export interface UsageSummaryInput {
  /** Resolved effective entitlements for the org (from resolveEntitlements). */
  entitlements: EntitlementMap
  /** Live `COUNT(*)` per creation-class feature slug the caller can measure. */
  creationCounts: Record<string, number>
  /** Current-period used level per stock/flow feature slug (org-summed rollups). */
  rollups: Record<string, number>
}

function usageFraction(used: number, limit: number): number {
  if (limit > 0) return used / limit
  return used > 0 ? Number.POSITIVE_INFINITY : 0
}

/** Assemble the unified meter list for the usage endpoint, sorted by slug. */
export function buildUsageSummary(input: UsageSummaryInput): UsageMeter[] {
  const out: UsageMeter[] = []

  for (const feature of Object.values(input.entitlements)) {
    if (!feature.meterable || feature.meterKind === null) continue
    if (feature.effective.type !== 'limit') continue

    const limit = feature.effective.limit // number | null (null = fair use)

    // Where the level comes from: creation meters use a live count (may be absent
    // in this scope → null); stock/flow meters use the rollup (absent → 0).
    const used =
      feature.meterKind === 'creation'
        ? (input.creationCounts[feature.slug] ?? null)
        : (input.rollups[feature.slug] ?? 0)

    if (used === null) {
      out.push({
        featureSlug: feature.slug,
        meterKind: feature.meterKind,
        used: null,
        limit,
        remaining: null,
        withinLimit: true,
        pct: 0,
      })
      continue
    }

    out.push({
      featureSlug: feature.slug,
      meterKind: feature.meterKind,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      withinLimit: limit === null || used <= limit,
      pct: limit === null ? 0 : usageFraction(used, limit),
    })
  }

  return out.sort((a, b) => a.featureSlug.localeCompare(b.featureSlug))
}
