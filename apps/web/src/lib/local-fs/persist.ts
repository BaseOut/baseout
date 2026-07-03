/**
 * Persistence for the dev local-disk ("Local disk (dev)") destination.
 *
 * local_fs is a managed, zero-setup destination — no OAuth. Connecting it
 * upserts the Space's local_fs storage_destinations row (one row per
 * (space_id, type); other providers' rows are untouched) and points the
 * Space's backup config at local_fs so runs write to the local-disk writer
 * (connecting a managed destination is an explicit "use this" action, so it
 * always takes primary).
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

  // Upsert the Space's local_fs row (keyed on (space_id, type)). The OAuth
  // null-outs are defensive — a local_fs row never holds cloud creds.
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
      target: [storageDestinations.spaceId, storageDestinations.type],
      set: {
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
