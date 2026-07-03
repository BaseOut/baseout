/**
 * Primary-destination (backup_configurations.storage_type) transitions under
 * multi-destination (shared-multi-destinations).
 *
 * A Space holds one storage_destinations row per provider type; the PRIMARY
 * destination — the one backups write to — is whichever type storage_type
 * points at. These helpers keep storage_type consistent when rows appear
 * (OAuth connect) or disappear (disconnect):
 *
 *  - Disconnect of the primary repoints to the most recently connected
 *    remaining destination, falling back to local_fs so storage_type never
 *    dangles at a row-less BYOS type.
 *  - A fresh connect auto-promotes to primary ONLY while the config still
 *    points at a managed default (r2_managed / local_fs) — it never steals
 *    primary from an explicitly chosen BYOS provider (closes the 2026-06-09
 *    "connected Box but still backing up to r2_managed" gap).
 *
 * Decisions are pure (tested in storage-type.test.ts); the Drizzle wrappers
 * below are used by the disconnect routes and OAuth callbacks.
 */

import { desc, eq } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { backupConfigurations, storageDestinations } from '../../db/schema'

export interface DisconnectDecisionInput {
  /** storage_type of the Space's config, or null when no config row exists. */
  currentStorageType: string | null
  /** The provider type whose row was just deleted. */
  disconnectedType: string
  /** Remaining destination types for the Space, most recently connected first. */
  remainingTypesByRecency: string[]
}

/**
 * What storage_type should become after a destination row is removed.
 * Returns the new value, or null when the config should be left untouched.
 */
export function decideStorageTypeAfterDisconnect(
  input: DisconnectDecisionInput,
): string | null {
  if (input.currentStorageType === null) return null
  if (input.currentStorageType !== input.disconnectedType) return null
  return input.remainingTypesByRecency[0] ?? 'local_fs'
}

/**
 * Whether a freshly connected destination may take primary: only while the
 * config still points at a managed default (or doesn't exist yet).
 */
export function shouldPromoteToPrimary(
  currentStorageType: string | null,
): boolean {
  return (
    currentStorageType === null ||
    currentStorageType === 'r2_managed' ||
    currentStorageType === 'local_fs'
  )
}

async function fetchStorageType(
  db: AppDb,
  spaceId: string,
): Promise<string | null> {
  const [config] = await db
    .select({ storageType: backupConfigurations.storageType })
    .from(backupConfigurations)
    .where(eq(backupConfigurations.spaceId, spaceId))
    .limit(1)
  return config?.storageType ?? null
}

/**
 * Apply the disconnect rule for a Space. Call AFTER the destination row for
 * `disconnectedType` has been deleted.
 */
export async function repointStorageTypeAfterDisconnect(
  db: AppDb,
  spaceId: string,
  disconnectedType: string,
): Promise<void> {
  const currentStorageType = await fetchStorageType(db, spaceId)
  const remaining = await db
    .select({ type: storageDestinations.type })
    .from(storageDestinations)
    .where(eq(storageDestinations.spaceId, spaceId))
    .orderBy(desc(storageDestinations.connectedAt))
  const next = decideStorageTypeAfterDisconnect({
    currentStorageType,
    disconnectedType,
    remainingTypesByRecency: remaining.map((r) => r.type),
  })
  if (next === null) return
  await db
    .update(backupConfigurations)
    .set({ storageType: next, modifiedAt: new Date() })
    .where(eq(backupConfigurations.spaceId, spaceId))
}

/**
 * Guarded auto-promotion for a Space. Call AFTER a successful OAuth connect
 * persisted the destination row for `connectedType`.
 */
export async function promoteStorageTypeIfDefault(
  db: AppDb,
  spaceId: string,
  connectedType: string,
): Promise<void> {
  const currentStorageType = await fetchStorageType(db, spaceId)
  if (!shouldPromoteToPrimary(currentStorageType)) return
  const now = new Date()
  await db
    .insert(backupConfigurations)
    .values({ spaceId, storageType: connectedType })
    .onConflictDoUpdate({
      target: backupConfigurations.spaceId,
      set: { storageType: connectedType, modifiedAt: now },
    })
}
