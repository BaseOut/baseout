/**
 * Isolation-class tier gate — pure (shared-db-isolation-ladder task L2.1).
 *
 * The `database_isolation_class` feature is a graded enum whose ordered
 * `enum_values` (e.g. ['d1','shared_cluster','dedicated_cluster','byodb']) ARE
 * the isolation ladder, ascending. The org's effective value is its CEILING:
 * the strongest isolation class its plan/overrides entitle it to. A Space may
 * be provisioned at any class at or below that ceiling.
 *
 * This module is data-driven: the ladder is read from the resolved feature's
 * `enumValues`, never hardcoded, so the catalog stays the single source of
 * truth. It reuses `getEnum` (mustGet-style ceiling read) and `enumRank`
 * (throws on non-ladder members) from the resolution/value helpers.
 */

import { type EntitlementMap, getEnum } from './resolve'
import { enumRank } from './values'

const FEATURE_SLUG = 'database_isolation_class'

/** An isolation class — a member of the `database_isolation_class` ladder. */
export type IsolationClass = string

/** The resolved feature's ordered ladder. Throws (getEnum) if not resolved/enum. */
function ladderFor(entitlements: EntitlementMap): {
  ladder: readonly string[]
  ceiling: IsolationClass
} {
  const ceiling = getEnum(entitlements, FEATURE_SLUG)
  const ladder = entitlements[FEATURE_SLUG]?.enumValues
  if (!ladder || ladder.length === 0) {
    throw new Error(`feature "${FEATURE_SLUG}" has no enum ladder`)
  }
  return { ladder, ceiling }
}

/**
 * The ladder members at or BELOW the org's ceiling (inclusive), in ladder order.
 * Throws if the feature isn't resolved/enum (mustGet-style, via getEnum).
 */
export function allowedIsolationClasses(entitlements: EntitlementMap): IsolationClass[] {
  const { ladder, ceiling } = ladderFor(entitlements)
  const ceilingRank = enumRank(ladder, ceiling)
  return ladder.filter((c) => enumRank(ladder, c) <= ceilingRank)
}

/**
 * Would provisioning at `requested` stay at or below the org's ceiling?
 * `allowed = rank(requested) <= rank(ceiling)`. Throws if `requested` isn't a
 * ladder member (enumRank throws on non-members).
 */
export function refuseAboveCeiling(
  requested: IsolationClass,
  entitlements: EntitlementMap,
): { allowed: boolean; ceiling: IsolationClass; requested: IsolationClass } {
  const { ladder, ceiling } = ladderFor(entitlements)
  const allowed = enumRank(ladder, requested) <= enumRank(ladder, ceiling)
  return { allowed, ceiling, requested }
}
