/**
 * Persist a successful Google Drive OAuth round-trip into storage_destinations.
 *
 * UPSERTs the row keyed on `space_id` (UNIQUE per schema). Re-connecting
 * replaces the row in place. Tokens are encrypted via the master key before
 * insert; the engine reads them on backup-start via the internal route.
 */

import { sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { storageDestinations } from '../../db/schema'
import { encryptToken } from '../crypto'
import type { TokenResponse } from './oauth'

export interface PersistDriveInputs {
  spaceId: string
  userId: string
  tokens: TokenResponse
  /** From `drive.about` — populates oauth_account_email + provider_account_id. */
  accountEmail?: string
  accountId?: string
  providerFolderId: string
}

export interface PersistDriveResult {
  destinationId: string
}

export async function persistDriveDestination(
  db: AppDb,
  encryptionKey: string,
  inputs: PersistDriveInputs,
): Promise<PersistDriveResult> {
  const accessTokenEnc = await encryptToken(
    inputs.tokens.accessToken,
    encryptionKey,
  )
  const refreshTokenEnc = inputs.tokens.refreshToken
    ? await encryptToken(inputs.tokens.refreshToken, encryptionKey)
    : null

  const expiresAt =
    typeof inputs.tokens.expiresIn === 'number'
      ? new Date(Date.now() + inputs.tokens.expiresIn * 1000)
      : null

  const now = new Date()
  const [row] = await db
    .insert(storageDestinations)
    .values({
      spaceId: inputs.spaceId,
      type: 'google_drive',
      oauthAccessTokenEnc: accessTokenEnc,
      oauthRefreshTokenEnc: refreshTokenEnc,
      oauthExpiresAt: expiresAt,
      oauthScope: inputs.tokens.scope,
      oauthAccountEmail: inputs.accountEmail ?? null,
      providerFolderId: inputs.providerFolderId,
      providerAccountId: inputs.accountId ?? null,
      connectedByUserId: inputs.userId,
      connectedAt: now,
      lastValidatedAt: now,
    })
    .onConflictDoUpdate({
      target: storageDestinations.spaceId,
      set: {
        type: sql`'google_drive'`,
        oauthAccessTokenEnc: sql`excluded.oauth_access_token_enc`,
        // Refresh tokens only come back on first consent (because we set
        // prompt=consent in the authorize URL). Replace iff the new exchange
        // produced one; otherwise preserve the existing value.
        oauthRefreshTokenEnc: refreshTokenEnc
          ? sql`excluded.oauth_refresh_token_enc`
          : sql`${storageDestinations.oauthRefreshTokenEnc}`,
        oauthExpiresAt: sql`excluded.oauth_expires_at`,
        oauthScope: sql`excluded.oauth_scope`,
        oauthAccountEmail: sql`excluded.oauth_account_email`,
        providerFolderId: sql`excluded.provider_folder_id`,
        providerAccountId: sql`excluded.provider_account_id`,
        connectedByUserId: sql`excluded.connected_by_user_id`,
        connectedAt: sql`excluded.connected_at`,
        lastValidatedAt: sql`excluded.last_validated_at`,
      },
    })
    .returning({ id: storageDestinations.id })

  return { destinationId: row.id }
}

/**
 * Hard-delete the destination row for a Space. Used by the disconnect route.
 * Returns the number of rows removed (0 or 1).
 */
export async function deleteDriveDestination(
  db: AppDb,
  spaceId: string,
): Promise<{ removed: number }> {
  const result = await db
    .delete(storageDestinations)
    .where(sql`${storageDestinations.spaceId} = ${spaceId}`)
    .returning({ id: storageDestinations.id })
  return { removed: result.length }
}
