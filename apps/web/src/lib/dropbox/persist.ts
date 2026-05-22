/**
 * Persist the result of a successful Dropbox OAuth round-trip:
 *   1) encrypt access + refresh tokens with AES-256-GCM
 *   2) upsert the per-Space `storage_destinations` row with type='dropbox'
 *
 * Mirror of `lib/google-drive/persist.ts`. Same per-Space-unique upsert
 * pattern (one storage destination per Space; switching providers updates
 * the existing row in place since `space_id` is UNIQUE).
 */

import { eq } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { storageDestinations } from '../../db/schema'
import { encryptToken } from '../crypto'
import type { TokenResponse } from './oauth'
import type { DropboxAccount } from './client'

export interface PersistInputs {
  userId: string
  spaceId: string
  tokens: TokenResponse
  account: DropboxAccount
  /** Literal Dropbox path of the auto-created `/Apps/Baseout/<spaceId>` folder. */
  providerFolderId: string
}

export interface PersistResult {
  storageDestinationId: string
}

export async function persistDropboxDestination(
  db: AppDb,
  encryptionKey: string,
  inputs: PersistInputs,
): Promise<PersistResult> {
  const accessTokenEnc = await encryptToken(
    inputs.tokens.accessToken,
    encryptionKey,
  )
  const refreshTokenEnc = inputs.tokens.refreshToken
    ? await encryptToken(inputs.tokens.refreshToken, encryptionKey)
    : null

  const oauthExpiresAt =
    typeof inputs.tokens.expiresIn === 'number'
      ? new Date(Date.now() + inputs.tokens.expiresIn * 1000)
      : null

  const now = new Date()

  const [existing] = await db
    .select({ id: storageDestinations.id })
    .from(storageDestinations)
    .where(eq(storageDestinations.spaceId, inputs.spaceId))
    .limit(1)

  let storageDestinationId: string
  if (existing) {
    await db
      .update(storageDestinations)
      .set({
        type: 'dropbox',
        oauthAccessTokenEnc: accessTokenEnc,
        oauthRefreshTokenEnc: refreshTokenEnc,
        oauthExpiresAt,
        oauthScope: inputs.tokens.scope,
        oauthAccountEmail: inputs.account.email,
        providerFolderId: inputs.providerFolderId,
        providerAccountId: inputs.account.accountId,
        connectedByUserId: inputs.userId,
        connectedAt: now,
        lastValidatedAt: now,
        modifiedAt: now,
      })
      .where(eq(storageDestinations.id, existing.id))
    storageDestinationId = existing.id
  } else {
    const [inserted] = await db
      .insert(storageDestinations)
      .values({
        spaceId: inputs.spaceId,
        type: 'dropbox',
        oauthAccessTokenEnc: accessTokenEnc,
        oauthRefreshTokenEnc: refreshTokenEnc,
        oauthExpiresAt,
        oauthScope: inputs.tokens.scope,
        oauthAccountEmail: inputs.account.email,
        providerFolderId: inputs.providerFolderId,
        providerAccountId: inputs.account.accountId,
        connectedByUserId: inputs.userId,
        connectedAt: now,
        lastValidatedAt: now,
      })
      .returning({ id: storageDestinations.id })
    storageDestinationId = inserted.id
  }

  return { storageDestinationId }
}
