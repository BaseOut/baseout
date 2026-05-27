/**
 * Persist a successful Dropbox OAuth round-trip into storage_destinations.
 *
 * UPSERTs the row keyed on `space_id` (UNIQUE per schema). Re-connecting
 * replaces the row in place. Tokens are encrypted via the master key before
 * insert; the engine reads them on backup-start via the internal route.
 *
 * Dropbox vs Box divergence (mirrors Drive's pattern): Dropbox refresh
 * tokens are STABLE (no rotation, no expiry by default). On an UPSERT
 * conflict we conditionally preserve the existing `oauth_refresh_token_enc`
 * if the new exchange didn't produce a new refresh_token (which only
 * happens when the caller is performing a refresh, not a code exchange).
 * For the initial code-exchange path through this function, Dropbox always
 * returns a refresh_token, so the conditional branch is defensive.
 */

import { sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { storageDestinations } from '../../db/schema'
import { encryptToken } from '../crypto'
import type { TokenResponse } from './oauth'

export interface PersistDropboxInputs {
  spaceId: string
  userId: string
  tokens: TokenResponse
  /** From `users/get_current_account` — populates oauth_account_email + provider_account_id. */
  accountEmail?: string
  accountId?: string
  /** Absolute Dropbox path of the per-Space folder (e.g. "/Baseout-<spaceId>"). */
  providerFolderId: string
}

export interface PersistDropboxResult {
  destinationId: string
}

export async function persistDropboxDestination(
  db: AppDb,
  encryptionKey: string,
  inputs: PersistDropboxInputs,
): Promise<PersistDropboxResult> {
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
      type: 'dropbox',
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
        type: sql`'dropbox'`,
        oauthAccessTokenEnc: sql`excluded.oauth_access_token_enc`,
        // Dropbox refresh tokens are stable. The initial code-exchange path
        // returns a refresh_token; the refresh path returns null. Preserve
        // the existing encrypted value when the new exchange did not produce
        // a fresh one — mirrors Drive's conditional-preserve pattern.
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
export async function deleteDropboxDestination(
  db: AppDb,
  spaceId: string,
): Promise<{ removed: number }> {
  const result = await db
    .delete(storageDestinations)
    .where(sql`${storageDestinations.spaceId} = ${spaceId}`)
    .returning({ id: storageDestinations.id })
  return { removed: result.length }
}
