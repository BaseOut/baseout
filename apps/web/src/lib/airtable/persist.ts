/**
 * Persist the result of a successful Airtable OAuth round-trip:
 *   1) encrypt access + refresh tokens
 *   2) upsert the `connections` row (scope='organization')
 *   3) upsert discovered bases into `at_bases`
 *
 * Pure function of (db, env, inputs) — so the callback route is thin and the
 * logic is integration-testable against a real DB without a browser round-trip.
 */

import { and, desc, eq, ne, sql } from 'drizzle-orm'
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

  // Airtable's refresh token expires ~60 days after last use; store the
  // absolute expiry so the keep-alive clock is known from Connect (the server
  // re-stamps it on every refresh).
  const refreshTokenExpiresAt =
    typeof inputs.tokens.refreshExpiresIn === 'number'
      ? new Date(Date.now() + inputs.tokens.refreshExpiresIn * 1000)
      : null

  const platformConfig = {
    at_user_id: inputs.whoami.id,
    is_enterprise_scope: (inputs.whoami.scopes ?? []).some((s) =>
      s.startsWith('enterprise.'),
    ),
  }

  // One active connection per (org, platform). Soft behaviour: if an existing
  // connection exists, update it in place rather than creating a duplicate.
  // One row per (org, platform). Reconnect updates the newest row in place —
  // never INSERT a second row (saves Airtable OAuth slots).
  const [existing] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.organizationId, inputs.organizationId),
        eq(connections.platformId, platform.id),
      ),
    )
    .orderBy(desc(connections.modifiedAt))
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
        refreshTokenExpiresAt,
        scopes: inputs.tokens.scope,
        platformConfig,
        status: 'active',
        invalidatedAt: null,
        modifiedAt: new Date(),
      })
      .where(eq(connections.id, existing.id))
    connectionId = existing.id
    // Retire legacy duplicate rows for this org (dev DB drift / pre-upsert data).
    await db
      .update(connections)
      .set({
        status: 'invalid',
        invalidatedAt: new Date(),
        modifiedAt: new Date(),
      })
      .where(
        and(
          eq(connections.organizationId, inputs.organizationId),
          eq(connections.platformId, platform.id),
          ne(connections.id, connectionId),
        ),
      )
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
        refreshTokenExpiresAt,
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
      .values(mapBasesToUpsertRows(inputs.bases, inputs.spaceId, now))
      .onConflictDoUpdate({
        target: [atBases.spaceId, atBases.atBaseId],
        set: {
          name: sql`excluded.name`,
          lastSeenAt: sql`excluded.last_seen_at`,
          // Workspace identity (web-workspace-bases): stamp when provided,
          // NULL-TOLERANT — a pass without workspace data (MCP failure,
          // plain Meta listing) must never clobber previously stamped
          // values, hence COALESCE against the existing row.
          workspaceId: sql`coalesce(excluded.workspace_id, ${atBases}.workspace_id)`,
          workspaceName: sql`coalesce(excluded.workspace_name, ${atBases}.workspace_name)`,
          modifiedAt: now,
        },
      })
  }

  return { connectionId, basesPersisted: inputs.bases.length }
}

/**
 * Upsert rows for the at_bases insert — exported for unit tests
 * (web-workspace-bases task 2.1: workspace fields stamped when provided,
 * null when absent).
 */
export function mapBasesToUpsertRows(
  bases: AirtableBaseSummary[],
  spaceId: string,
  now: Date,
): Array<{
  spaceId: string
  atBaseId: string
  name: string
  workspaceId: string | null
  workspaceName: string | null
  lastSeenAt: Date
}> {
  return bases.map((b) => ({
    spaceId,
    atBaseId: b.id,
    name: b.name,
    workspaceId: b.workspaceId ?? null,
    workspaceName: b.workspaceName ?? null,
    lastSeenAt: now,
  }))
}
