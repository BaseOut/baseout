/**
 * Usage-endpoint handler (shared-entitlements task 9.1). Pure DI so it unit-tests
 * with fakes; the route (`GET /api/usage`) assembles the real deps —
 * `resolveEntitlements`, the live creation `COUNT(*)`s, and the current-period
 * rollup read — and serves the result.
 *
 * Returns an empty payload (planSlug null, no meters) when the org has no
 * resolvable plan, short-circuiting the usage reads.
 */

import { buildUsageSummary, type EntitlementMap, type UsageMeter } from '@baseout/db-schema'

export interface UsageResponseDeps {
  /** Effective entitlements + plan slug for the org, or null if no active plan. */
  resolveEntitlements: (
    organizationId: string,
  ) => Promise<{ planSlug: string; entitlements: EntitlementMap } | null>
  /** Live `COUNT(*)` per creation-class feature slug the web scope can measure. */
  creationCounts: (organizationId: string) => Promise<Record<string, number>>
  /** Current-period used level per stock/flow feature slug (org-summed rollups). */
  readRollups: (organizationId: string) => Promise<Record<string, number>>
}

export interface UsageResponse {
  planSlug: string | null
  meters: UsageMeter[]
}

export async function buildUsageResponse(
  organizationId: string,
  deps: UsageResponseDeps,
): Promise<UsageResponse> {
  const resolution = await deps.resolveEntitlements(organizationId)
  if (!resolution) return { planSlug: null, meters: [] }

  const [creationCounts, rollups] = await Promise.all([
    deps.creationCounts(organizationId),
    deps.readRollups(organizationId),
  ])

  const meters = buildUsageSummary({
    entitlements: resolution.entitlements,
    creationCounts,
    rollups,
  })

  return { planSlug: resolution.planSlug, meters }
}
