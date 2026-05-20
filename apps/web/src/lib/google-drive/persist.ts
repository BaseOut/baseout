/**
 * Persist the result of a successful Google Drive OAuth round-trip:
 *   1) encrypt access + refresh tokens with AES-256-GCM
 *   2) upsert the per-Space `storage_destinations` row with type='google_drive'
 *
 * Pure function of (db, key, inputs) — keeps the callback route thin and
 * makes integration testing against a real DB straightforward.
 */

import { eq } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { storageDestinations } from '../../db/schema'
import { encryptToken } from '../crypto'
import type { TokenResponse } from './oauth'
import type { GoogleUserinfo } from './client'

export interface PersistInputs {
  userId: string
  spaceId: string
  tokens: TokenResponse
  userinfo: GoogleUserinfo
  /** ID of the auto-created Baseout-<spaceId> Drive folder. */
  providerFolderId: string
}

export interface PersistResult {
  storageDestinationId: string
}

export async function persistGoogleDriveDestination(
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

  // One destination row per Space (`space_id` UNIQUE). If one exists for this
  // Space we update in place — even when switching providers — because the
  // unique constraint forbids two rows for the same Space.
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
        type: 'google_drive',
        oauthAccessTokenEnc: accessTokenEnc,
        oauthRefreshTokenEnc: refreshTokenEnc,
        oauthExpiresAt,
        oauthScope: inputs.tokens.scope,
        oauthAccountEmail: inputs.userinfo.email,
        providerFolderId: inputs.providerFolderId,
        providerAccountId: inputs.userinfo.sub,
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
        type: 'google_drive',
        oauthAccessTokenEnc: accessTokenEnc,
        oauthRefreshTokenEnc: refreshTokenEnc,
        oauthExpiresAt,
        oauthScope: inputs.tokens.scope,
        oauthAccountEmail: inputs.userinfo.email,
        providerFolderId: inputs.providerFolderId,
        providerAccountId: inputs.userinfo.sub,
        connectedByUserId: inputs.userId,
        connectedAt: now,
        lastValidatedAt: now,
      })
      .returning({ id: storageDestinations.id })
    storageDestinationId = inserted.id
  }

  return { storageDestinationId }
}
