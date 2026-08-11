/**
 * Persist a Space's base selection. Idempotent: creates the
 * backup_configurations row on first call, then upserts/updates
 * backup_configuration_bases entries to match the (toEnable, toDisable) diff
 * computed by planBaseSelection.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  backupConfigurationBases,
  backupConfigurations,
} from '../../db/schema'

export interface PersistBaseSelectionInputs {
  spaceId: string
  toEnable: string[]   // at_bases.id values
  toDisable: string[]  // at_bases.id values
}

export interface PersistBaseSelectionResult {
  backupConfigurationId: string
}

async function ensureBackupConfiguration(
  db: AppDb,
  spaceId: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: backupConfigurations.id })
    .from(backupConfigurations)
    .where(eq(backupConfigurations.spaceId, spaceId))
    .limit(1)
  if (existing) return existing.id

  // Default new configs to the dev local-disk destination. R2 is parked and
  // BYOS providers require an explicit connect, so local_fs is the only
  // zero-setup destination — backups work immediately, and the user can switch
  // from the Backups page. (The schema default is the legacy r2_managed, which
  // also routes to the local-disk writer; this makes the intent explicit.)
  const [inserted] = await db
    .insert(backupConfigurations)
    .values({ spaceId, storageType: 'local_fs' })
    .returning({ id: backupConfigurations.id })
  return inserted.id
}

export async function persistBaseSelection(
  db: AppDb,
  inputs: PersistBaseSelectionInputs,
): Promise<PersistBaseSelectionResult> {
  const backupConfigurationId = await ensureBackupConfiguration(db, inputs.spaceId)

  const now = new Date()

  if (inputs.toEnable.length > 0) {
    await db
      .insert(backupConfigurationBases)
      .values(
        inputs.toEnable.map((atBaseId) => ({
          backupConfigurationId,
          atBaseId,
          isIncluded: true,
        })),
      )
      .onConflictDoUpdate({
        target: [
          backupConfigurationBases.backupConfigurationId,
          backupConfigurationBases.atBaseId,
        ],
        set: {
          isIncluded: true,
          modifiedAt: now,
        },
      })
  }

  if (inputs.toDisable.length > 0) {
    await db
      .update(backupConfigurationBases)
      .set({ isIncluded: false, modifiedAt: now })
      .where(
        and(
          eq(backupConfigurationBases.backupConfigurationId, backupConfigurationId),
          inArray(backupConfigurationBases.atBaseId, inputs.toDisable),
        ),
      )
  }

  return { backupConfigurationId }
}
