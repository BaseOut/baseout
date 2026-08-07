/**
 * External-destinations creation-cap enforcement (shared-entitlements 4.3).
 *
 * The `snapshot_destinations_external` meter is per-Organization, but destinations
 * are `storage_destinations` rows keyed `(space_id, type)`. Connecting a provider
 * is an UPSERT on that key, so re-connecting an existing provider REPLACES its row
 * (not a new destination) and must always pass. The gate therefore counts the
 * org's distinct external destinations EXCLUDING the exact `(space, type)` being
 * connected, then asks `canCreate` (via the shared `checkCreationCap`).
 *
 * `decideDestinationCap` is the pure DI core (unit-tested with fakes);
 * `enforceDestinationCap` is the thin real-deps wrapper the four BYOS OAuth
 * callbacks call. Behind ENTITLEMENT_ENFORCEMENT (off → dark); fails open when the
 * Space has no resolvable org.
 */

import { and, count, eq, ne, or } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { spaces, storageDestinations } from '../../db/schema'
import { checkCreationCap, type CreationCapDecision } from './enforce-create'
import { resolveEntitlements } from './resolve'
import type { EntitlementMap } from '@baseout/db-schema'

const FEATURE = 'snapshot_destinations_external'
const ADDON = 'destinations_1'

export interface DestinationCapDeps {
  /** ENTITLEMENT_ENFORCEMENT flag. Off → allow (dark, no queries). */
  enforcementEnabled: boolean
  /** The Space's owning org, or null (→ allow; the callback surfaces its own error). */
  resolveOrgForSpace: (spaceId: string) => Promise<string | null>
  resolveEntitlements: (
    organizationId: string,
  ) => Promise<{ entitlements: EntitlementMap } | null>
  /** Distinct external destinations for the org, EXCLUDING the (space, type) being connected. */
  countExternalExcluding: (
    organizationId: string,
    spaceId: string,
    type: string,
  ) => Promise<number>
}

function allow(): CreationCapDecision {
  return { allowed: true, featureSlug: FEATURE, used: null, limit: null, addonSlug: ADDON }
}

export async function decideDestinationCap(
  spaceId: string,
  type: string,
  deps: DestinationCapDeps,
): Promise<CreationCapDecision> {
  if (!deps.enforcementEnabled) return allow()
  const organizationId = await deps.resolveOrgForSpace(spaceId)
  if (!organizationId) return allow()
  return checkCreationCap(organizationId, FEATURE, {
    enforcementEnabled: true,
    resolveEntitlements: deps.resolveEntitlements,
    count: (id) => deps.countExternalExcluding(id, spaceId, type),
  })
}

/**
 * Real-deps wrapper for the OAuth callbacks: resolves the Space's org, counts the
 * org's external destinations excluding this (space, type), and gates. Returns the
 * decision; the callback redirects with `storage_error=limit_reached` when blocked.
 */
export async function enforceDestinationCap(
  db: AppDb,
  spaceId: string,
  type: string,
  enforcementEnabled: boolean,
): Promise<CreationCapDecision> {
  return decideDestinationCap(spaceId, type, {
    enforcementEnabled,
    resolveOrgForSpace: async (sid) => {
      const [row] = await db
        .select({ orgId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, sid))
        .limit(1)
      return row?.orgId ?? null
    },
    resolveEntitlements: (id) => resolveEntitlements(db, id),
    countExternalExcluding: async (organizationId, sid, t) => {
      const [row] = await db
        .select({ n: count() })
        .from(storageDestinations)
        .innerJoin(spaces, eq(spaces.id, storageDestinations.spaceId))
        .where(
          and(
            eq(spaces.organizationId, organizationId),
            ne(storageDestinations.type, 'local_fs'),
            // exclude the exact (space, type) being (re)connected
            or(
              ne(storageDestinations.spaceId, sid),
              ne(storageDestinations.type, t),
            ),
          ),
        )
      return Number(row?.n ?? 0)
    },
  })
}
