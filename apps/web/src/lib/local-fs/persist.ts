/**
 * Persistence for the dev local-disk ("Local disk (dev)") destination.
 *
 * local_fs is a managed, zero-setup destination — no OAuth. Connecting it
 * upserts a storage_destinations row (clearing any prior cloud OAuth fields,
 * since a Space has at most one destination) and points the Space's backup
 * config at local_fs so runs write to the local-disk writer.
 *
 * Each storage provider owns its own module (mirrors lib/box, lib/google-drive)
 * so provider work stays isolated and can't regress Airtable/other providers.
 */

import type { AppDb } from '../../db'
import { backupConfigurations, storageDestinations } from '../../db/schema'

export interface ConnectLocalFsInput {
  spaceId: string
  /** User who connected it (audit); null when unavailable. */
  userId: string | null
}

export async function connectLocalFsDestination(
  db: AppDb,
  input: ConnectLocalFsInput,
): Promise<void> {
  const now = new Date()

  // One destination per Space (storage_destinations.space_id is UNIQUE). Upsert
  // to local_fs, clearing any cloud OAuth fields left by a prior destination.
  await db
    .insert(storageDestinations)
    .values({
      spaceId: input.spaceId,
      type: 'local_fs',
      connectedByUserId: input.userId,
      connectedAt: now,
      lastValidatedAt: now,
    })
    .onConflictDoUpdate({
      target: storageDestinations.spaceId,
      set: {
        type: 'local_fs',
        oauthAccessTokenEnc: null,
        oauthRefreshTokenEnc: null,
        oauthExpiresAt: null,
        oauthScope: null,
        oauthAccountEmail: null,
        providerFolderId: null,
        providerAccountId: null,
        connectedByUserId: input.userId,
        connectedAt: now,
        lastValidatedAt: now,
      },
    })

  // Point the backup config at local_fs (creating the row if the Space has none
  // yet). Mirrors the buildUpsert pattern in the backup-config route.
  await db
    .insert(backupConfigurations)
    .values({ spaceId: input.spaceId, storageType: 'local_fs' })
    .onConflictDoUpdate({
      target: backupConfigurations.spaceId,
      set: { storageType: 'local_fs', modifiedAt: now },
    })
}
