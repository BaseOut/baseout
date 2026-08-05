/**
 * Bridge: DB-native entitlements (`resolveEntitlements`) → the `TierCapabilitySet`
 * the UI gates read (shared-entitlements task 2.3). This is the cutover seam that
 * lets `resolveCapabilities` stop reading the cached `subscription_items.tier`
 * and derive gates from the `plan_features` catalog instead.
 *
 * Spec alignment (research/pricing/pricing-guide.md §3–§4, 2026-08-03):
 *   - basesPerSpace ← `bases_under_management` (org-wide cap; the per-Space gate
 *     is retired per the 2026-08-04 product decision — the new model caps total
 *     bases across all Spaces, not per Space).
 *   - frequencies ← `backup_frequency_max` (enum) expanded down the
 *     FREQUENCY_LADDER; `one_time` is not a scheduled cadence so it drops out of
 *     the picker list — a Trial org (`backup_frequency_max = one_time`) yields no
 *     scheduled cadences, which is correct (Trial = a single one-off backup).
 *   - schemaDocs: the new model has NO authoring-level lever (docs are gated by
 *     the `documents` COUNT, available on every plan). We preserve the legacy
 *     gate's intent by deriving the level from AI capability: `byo_ai_key` →
 *     `manual_ai` (Plus+), else `manual`. `none` never applies — every plan can
 *     author docs.
 *   - webhookPollMinSeconds: NOT a priced lever (guide §"not purchasable"). It's
 *     an operational floor that only matters for instant-capable plans; derived
 *     from `backup_frequency_max` (instant → 300s, else the moot 900s default).
 *     Enterprise's tighter floor is contract-override territory.
 *
 * No new catalog features are seeded for schemaDocs/webhookPoll — doing so would
 * invent pricing levers the locked model doesn't define (and break the catalog
 * drift test). The derivations above use only real, seeded features.
 */

import { getBool, getEnum, getLimit, type EntitlementMap } from '@baseout/db-schema'
import { FREQUENCY_LADDER } from '../../db/seed/entitlements-catalog'
import type { Frequency, SchemaDocsLevel, TierCapabilitySet } from './tier-capabilities'

// Scheduled cadences the picker understands (FREQUENCY_LADDER minus the
// non-scheduled `one_time`). Order-preserving.
const SCHEDULED_FREQUENCIES: readonly Frequency[] = ['monthly', 'weekly', 'daily', 'instant']

/** Operational Instant poll floor (seconds). Not a pricing lever — see header. */
const INSTANT_POLL_MIN_SECONDS = 300
const DEFAULT_POLL_MIN_SECONDS = 900 // moot for non-instant plans (they never poll)

/** All ladder members up to and including `max`, filtered to scheduled cadences. */
function frequenciesUpTo(max: string): Frequency[] {
  const rank = FREQUENCY_LADDER.indexOf(max as (typeof FREQUENCY_LADDER)[number])
  if (rank === -1) return []
  const allowed = FREQUENCY_LADDER.slice(0, rank + 1)
  return SCHEDULED_FREQUENCIES.filter((f) => allowed.includes(f as (typeof FREQUENCY_LADDER)[number]))
}

/**
 * Derive the capability set a plan grants from its resolved entitlements. Throws
 * if a required feature slug is absent from the map (a catalog-integrity error);
 * callers that want the legacy fallback should catch and fall back to
 * `getTierCapabilities`.
 */
export function entitlementsToCapabilities(entitlements: EntitlementMap): TierCapabilitySet {
  const maxCadence = getEnum(entitlements, 'backup_frequency_max')
  const hasInstant = FREQUENCY_LADDER.indexOf(maxCadence as (typeof FREQUENCY_LADDER)[number]) >=
    FREQUENCY_LADDER.indexOf('instant')

  const schemaDocs: SchemaDocsLevel = getBool(entitlements, 'byo_ai_key') ? 'manual_ai' : 'manual'

  return {
    basesPerSpace: getLimit(entitlements, 'bases_under_management'), // null = fair use / unlimited
    frequencies: frequenciesUpTo(maxCadence),
    schemaDocs,
    webhookPollMinSeconds: hasInstant ? INSTANT_POLL_MIN_SECONDS : DEFAULT_POLL_MIN_SECONDS,
  }
}
