/**
 * Persist a successful OneDrive OAuth round-trip into storage_destinations.
 *
 * UPSERTs the OneDrive row keyed on `(space_id, type)` (UNIQUE per schema) —
 * re-connecting replaces only OneDrive's row; other providers' rows for the
 * Space are untouched. Tokens are encrypted via the master key before insert;
 * the engine reads them on backup-start via the internal route.
 *
 * OneDrive vs Drive/Dropbox divergence (mirrors Box's pattern): Microsoft
 * rotates refresh tokens on EVERY response. Both the initial code exchange
 * AND the refresh call return a fresh refresh_token. On UPSERT conflict we
 * unconditionally overwrite `oauth_refresh_token_enc` from the new exchange
 * — there is no "preserve stored value" branch as in Dropbox/Drive because
 * Microsoft never returns null for the refresh_token on a successful response.
 */

import { sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { storageDestinations } from '../../db/schema'
import { encryptToken } from '../crypto'
import type { TokenResponse } from './oauth'

export interface PersistOneDriveInputs {
  spaceId: string
  userId: string
  tokens: TokenResponse
  /** From /me — populates oauth_account_email + provider_account_id. */
  accountEmail?: string | null
  accountId?: string | null
  /** Graph DriveItem `id` of the per-Space folder (opaque alphanumeric). */
  providerFolderId: string
}

export interface PersistOneDriveResult {
  destinationId: string
}

export async function persistOneDriveDestination(
  db: AppDb,
  encryptionKey: string,
  inputs: PersistOneDriveInputs,
): Promise<PersistOneDriveResult> {
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
      type: 'onedrive',
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
      target: [storageDestinations.spaceId, storageDestinations.type],
      set: {
        oauthAccessTokenEnc: sql`excluded.oauth_access_token_enc`,
        // Microsoft rotates refresh tokens on every refresh — always
        // overwrite with the new ciphertext. No conditional-preserve branch.
        oauthRefreshTokenEnc: sql`excluded.oauth_refresh_token_enc`,
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
 * Hard-delete the Space's OneDrive destination row. Used by the disconnect
 * route. Scoped to type='onedrive' so other providers' rows survive.
 * Returns the number of rows removed (0 or 1).
 */
export async function deleteOneDriveDestination(
  db: AppDb,
  spaceId: string,
): Promise<{ removed: number }> {
  const result = await db
    .delete(storageDestinations)
    .where(
      sql`${storageDestinations.spaceId} = ${spaceId} AND ${storageDestinations.type} = 'onedrive'`,
    )
    .returning({ id: storageDestinations.id })
  return { removed: result.length }
}
