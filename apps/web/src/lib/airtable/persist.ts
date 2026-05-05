/**
 * Persist the result of a successful Airtable OAuth round-trip:
 *   1) encrypt access + refresh tokens
 *   2) upsert the `connections` row (scope='organization')
 *   3) upsert discovered bases into `at_bases`
 *
 * Pure function of (db, env, inputs) — so the callback route is thin and the
 * logic is integration-testable against a real DB without a browser round-trip.
 */

import { and, eq, sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  atBases,
  connections,
  platforms,
} from '../../db/schema'
import { encryptToken } from '../crypto'
import type { TokenResponse } from './oauth'
import type { AirtableBaseSummary, AirtableWhoami } from './client'

export interface PersistInputs {
  userId: string
  organizationId: string
  spaceId: string
  tokens: TokenResponse
  whoami: AirtableWhoami
  bases: AirtableBaseSummary[]
}

export interface PersistResult {
  connectionId: string
  basesPersisted: number
}

export async function persistAirtableConnection(
  db: AppDb,
  encryptionKey: string,
  inputs: PersistInputs,
): Promise<PersistResult> {
  const [platform] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.slug, 'airtable'))
    .limit(1)
  if (!platform) {
    throw new Error('Airtable platform row missing — run `npm run seed`.')
  }

  const accessTokenEnc = await encryptToken(
    inputs.tokens.accessToken,
    encryptionKey,
  )
  const refreshTokenEnc = inputs.tokens.refreshToken
    ? await encryptToken(inputs.tokens.refreshToken, encryptionKey)
    : null

  const tokenExpiresAt =
    typeof inputs.tokens.expiresIn === 'number'
      ? new Date(Date.now() + inputs.tokens.expiresIn * 1000)
      : null

  const platformConfig = {
    at_user_id: inputs.whoami.id,
    is_enterprise_scope: (inputs.whoami.scopes ?? []).some((s) =>
      s.startsWith('enterprise.'),
    ),
  }

  // One active connection per (org, platform). Soft behaviour: if an existing
  // connection exists, update it in place rather than creating a duplicate.
  const [existing] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.organizationId, inputs.organizationId),
        eq(connections.platformId, platform.id),
      ),
    )
    .limit(1)

  let connectionId: string
  if (existing) {
    await db
      .update(connections)
      .set({
        createdByUserId: inputs.userId,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        scopes: inputs.tokens.scope,
        platformConfig,
        status: 'active',
        invalidatedAt: null,
        modifiedAt: new Date(),
      })
      .where(eq(connections.id, existing.id))
    connectionId = existing.id
  } else {
    const [inserted] = await db
      .insert(connections)
      .values({
        organizationId: inputs.organizationId,
        platformId: platform.id,
        createdByUserId: inputs.userId,
        scope: 'organization',
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        scopes: inputs.tokens.scope,
        platformConfig,
        status: 'active',
      })
      .returning({ id: connections.id })
    connectionId = inserted.id
  }

  const now = new Date()
  if (inputs.bases.length > 0) {
    await db
      .insert(atBases)
      .values(
        inputs.bases.map((b) => ({
          spaceId: inputs.spaceId,
          atBaseId: b.id,
          name: b.name,
          lastSeenAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [atBases.spaceId, atBases.atBaseId],
        set: {
          name: sql`excluded.name`,
          lastSeenAt: sql`excluded.last_seen_at`,
          modifiedAt: now,
        },
      })
  }

  return { connectionId, basesPersisted: inputs.bases.length }
}
