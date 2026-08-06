/**
 * Create-time creation-cap enforcement (shared-entitlements task 4.3, creation-cap
 * subset). Design D7: enforcement action for creation-class meters is "block the
 * create action only" — in-flight jobs and existing data are never touched, and
 * restores are never blocked by another meter (this gate only guards creates).
 *
 * Pure DI so it unit-tests with fakes; the route assembles the real deps
 * (`resolveEntitlements` + a live `COUNT(*)` of the resource). Gated by
 * ENTITLEMENT_ENFORCEMENT: flag off → allow (dark, no resolve/count work). Fails
 * OPEN when the org has no resolvable plan — a resolution gap must not block a
 * legitimate create. The one-more-slot decision is the pure `canCreate` kernel.
 */

import { canCreate, type EntitlementMap } from '@baseout/db-schema'

export interface CreationCapDeps {
  /** ENTITLEMENT_ENFORCEMENT flag (task 4.3). Default off → allow. */
  enforcementEnabled: boolean
  /** Effective entitlements for the org, or null if there's no active plan (→ allow). */
  resolveEntitlements: (
    organizationId: string,
  ) => Promise<{ entitlements: EntitlementMap } | null>
  /** Live count of the resource for the org (the `COUNT(*)`). */
  count: (organizationId: string) => Promise<number>
}

export interface CreationCapDecision {
  allowed: boolean
  featureSlug: string
  /** Live count when evaluated; null when short-circuited (flag off / no plan). */
  used: number | null
  /** Effective cap; null = fair use, or when short-circuited. */
  limit: number | null
  /** Add-on that raises this cap, for the block payload's upgrade hint. */
  addonSlug: string | null
}

/** Creation-cap feature → the add-on that raises it (seeded add-on catalog). */
const ADDON_FOR_FEATURE: Record<string, string> = {
  spaces: 'spaces_1',
  bases_under_management: 'bases_3',
  seats: 'seats_2',
  snapshot_destinations_external: 'destinations_1',
  active_reports: 'reports_5',
  documents: 'documents_10',
}

export async function checkCreationCap(
  organizationId: string,
  featureSlug: string,
  deps: CreationCapDeps,
): Promise<CreationCapDecision> {
  const addonSlug = ADDON_FOR_FEATURE[featureSlug] ?? null

  // Flag off → dark: allow without resolving or counting.
  if (!deps.enforcementEnabled) {
    return { allowed: true, featureSlug, used: null, limit: null, addonSlug }
  }

  // No active plan → fail open (don't block on a resolution gap; don't count).
  const resolution = await deps.resolveEntitlements(organizationId)
  if (!resolution) {
    return { allowed: true, featureSlug, used: null, limit: null, addonSlug }
  }

  const used = await deps.count(organizationId)
  const allowed = canCreate(resolution.entitlements, featureSlug, used)
  const feature = resolution.entitlements[featureSlug]
  const limit = feature?.effective.type === 'limit' ? feature.effective.limit : null

  return { allowed, featureSlug, used, limit, addonSlug }
}
