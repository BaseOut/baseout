/**
 * Persist a successful Box OAuth round-trip into storage_destinations.
 *
 * UPSERTs the row keyed on `space_id` (UNIQUE per schema). Re-connecting
 * replaces the row in place. Tokens are encrypted via the master key before
 * insert; the engine reads them on backup-start via the internal route.
 *
 * Box vs. Drive divergence: Box rotates refresh tokens on every refresh AND
 * on every fresh code exchange. Whenever we persist a Box destination we
 * ALWAYS overwrite `oauth_refresh_token_enc` with the new value — never
 * preserve the old one. Drive's persist conditionally preserves the old
 * refresh token because Google's `prompt=consent` may not always re-issue;
 * Box doesn't have that wrinkle.
 */

import { sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { storageDestinations } from '../../db/schema'
import { encryptToken } from '../crypto'
import type { TokenResponse } from './oauth'

export interface PersistBoxInputs {
  spaceId: string
  userId: string
  tokens: TokenResponse
  /** From `users/me` — populates oauth_account_email + provider_account_id. */
  accountEmail?: string
  accountId?: string
  providerFolderId: string
}

export interface PersistBoxResult {
  destinationId: string
}

export async function persistBoxDestination(
  db: AppDb,
  encryptionKey: string,
  inputs: PersistBoxInputs,
): Promise<PersistBoxResult> {
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
      type: 'box',
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
        type: sql`'box'`,
        oauthAccessTokenEnc: sql`excluded.oauth_access_token_enc`,
        // Box rotates refresh tokens on every code exchange. Always replace
        // — never preserve a previous Box refresh token, it's invalidated
        // by the new grant within ~60s.
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
 * Hard-delete the destination row for a Space. Used by the disconnect route.
 * Returns the number of rows removed (0 or 1).
 */
export async function deleteBoxDestination(
  db: AppDb,
  spaceId: string,
): Promise<{ removed: number }> {
  const result = await db
    .delete(storageDestinations)
    .where(sql`${storageDestinations.spaceId} = ${spaceId}`)
    .returning({ id: storageDestinations.id })
  return { removed: result.length }
}
