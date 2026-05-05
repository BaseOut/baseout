import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { randomBytes, randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { createDb } from '../../src/db'
import {
  connections,
  organizationMembers,
  organizations,
  platforms,
  spaces,
  users,
  atBases,
} from '../../src/db/schema'
import { persistAirtableConnection } from '../../src/lib/airtable/persist'
import { persistBaseSelection } from '../../src/lib/backup-config/persist'
import { decryptToken, generateEncryptionKey } from '../../src/lib/crypto'
import { getIntegrationsState } from '../../src/lib/integrations'
import { seedSubscriptionItem } from './setup/testHarness'

const { db } = createDb(env.HYPERDRIVE.connectionString)
const KEY = generateEncryptionKey()

async function resetBaseoutTables(): Promise<void> {
  // Truncate in dependency order. CASCADE handles referencing tables not listed.
  await db.execute(
    sql.raw(
      `TRUNCATE TABLE
        baseout.backup_configuration_bases,
        baseout.backup_configurations,
        baseout.at_bases,
        baseout.connection_sessions,
        baseout.connections,
        baseout.space_platforms,
        baseout.spaces,
        baseout.user_preferences,
        baseout.organization_members,
        baseout.subscription_items,
        baseout.subscriptions,
        baseout.overage_records,
        baseout.organizations,
        baseout.platforms,
        baseout.sessions,
        baseout.accounts,
        baseout.verifications,
        baseout.users
      RESTART IDENTITY CASCADE`,
    ),
  )
}

interface Fixture {
  userId: string
  organizationId: string
  spaceId: string
}

async function seedFixture(): Promise<Fixture> {
  const userId = randomUUID()
  const organizationId = randomUUID()
  const spaceId = randomUUID()
  const slug = `org-${randomBytes(4).toString('hex')}`

  await db.insert(users).values({
    id: userId,
    name: 'Test User',
    email: `test-${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await db.insert(organizations).values({
    id: organizationId,
    name: 'Test Org',
    slug,
  })
  await db.insert(organizationMembers).values({
    organizationId,
    userId,
    role: 'owner',
    isDefault: true,
  })
  await db.insert(spaces).values({
    id: spaceId,
    organizationId,
    name: 'Test Space',
  })
  await db.insert(platforms).values({
    slug: 'airtable',
    code: 'at',
    name: 'Airtable',
    websiteUrl: 'https://airtable.com',
  })

  return { userId, organizationId, spaceId }
}

describe('persistAirtableConnection (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('inserts a connection with encrypted tokens and upserts discovered bases', async () => {
    const { userId, organizationId, spaceId } = await seedFixture()

    const result = await persistAirtableConnection(db, KEY, {
      userId,
      organizationId,
      spaceId,
      tokens: {
        accessToken: 'airtable_at_plaintext',
        refreshToken: 'airtable_rt_plaintext',
        expiresIn: 3600,
        scope: 'data.records:read schema.bases:read',
      },
      whoami: {
        id: 'usrABC',
        scopes: ['data.records:read'],
        email: 'at@example.com',
      },
      bases: [
        { id: 'appOne', name: 'Base One', permissionLevel: 'create' },
        { id: 'appTwo', name: 'Base Two', permissionLevel: 'edit' },
      ],
    })

    expect(result.basesPersisted).toBe(2)
    expect(typeof result.connectionId).toBe('string')

    const rows = await db
      .select()
      .from(connections)
      .where(eq(connections.organizationId, organizationId))
    expect(rows).toHaveLength(1)
    const row = rows[0]

    // Tokens are not plaintext in the DB.
    expect(row.accessTokenEnc).not.toContain('airtable_at_plaintext')
    expect(row.refreshTokenEnc ?? '').not.toContain('airtable_rt_plaintext')

    // They round-trip through decryptToken.
    await expect(decryptToken(row.accessTokenEnc, KEY)).resolves.toBe(
      'airtable_at_plaintext',
    )
    expect(row.refreshTokenEnc).not.toBeNull()
    await expect(decryptToken(row.refreshTokenEnc as string, KEY)).resolves.toBe(
      'airtable_rt_plaintext',
    )

    expect(row.status).toBe('active')
    expect(row.scope).toBe('organization')
    expect(row.scopes).toBe('data.records:read schema.bases:read')
    expect(row.createdByUserId).toBe(userId)
    expect(row.platformConfig).toMatchObject({
      at_user_id: 'usrABC',
      is_enterprise_scope: false,
    })
    expect(row.tokenExpiresAt).toBeTruthy()

    const baseRows = await db
      .select({ atBaseId: atBases.atBaseId, name: atBases.name })
      .from(atBases)
      .where(eq(atBases.spaceId, spaceId))
      .orderBy(atBases.atBaseId)
    expect(baseRows.map((b) => b.atBaseId)).toEqual(['appOne', 'appTwo'])
    expect(baseRows.map((b) => b.name)).toEqual(['Base One', 'Base Two'])
  })

  it('updates an existing connection in place on re-auth', async () => {
    const { userId, organizationId, spaceId } = await seedFixture()

    const first = await persistAirtableConnection(db, KEY, {
      userId,
      organizationId,
      spaceId,
      tokens: {
        accessToken: 'old_at',
        refreshToken: 'old_rt',
        expiresIn: 3600,
        scope: 'data.records:read',
      },
      whoami: { id: 'usrABC', scopes: ['data.records:read'] },
      bases: [{ id: 'appOne', name: 'Base One v1', permissionLevel: 'create' }],
    })

    const second = await persistAirtableConnection(db, KEY, {
      userId,
      organizationId,
      spaceId,
      tokens: {
        accessToken: 'new_at',
        refreshToken: 'new_rt',
        expiresIn: 7200,
        scope: 'data.records:read schema.bases:read',
      },
      whoami: { id: 'usrABC', scopes: ['data.records:read', 'schema.bases:read'] },
      bases: [{ id: 'appOne', name: 'Base One v2', permissionLevel: 'edit' }],
    })

    expect(second.connectionId).toBe(first.connectionId)

    const allRows = await db
      .select()
      .from(connections)
      .where(eq(connections.organizationId, organizationId))
    expect(allRows).toHaveLength(1)

    const [freshRow] = await db
      .select({ accessTokenEnc: connections.accessTokenEnc })
      .from(connections)
      .where(eq(connections.id, second.connectionId))
    await expect(decryptToken(freshRow.accessTokenEnc, KEY)).resolves.toBe(
      'new_at',
    )

    const [baseRow] = await db
      .select({ name: atBases.name })
      .from(atBases)
      .where(eq(atBases.spaceId, spaceId))
    expect(baseRow.name).toBe('Base One v2')
  })

  it('throws a clear error when the airtable platform row is missing', async () => {
    const { userId, organizationId, spaceId } = await seedFixture()
    await db.delete(platforms).where(eq(platforms.slug, 'airtable'))

    await expect(
      persistAirtableConnection(db, KEY, {
        userId,
        organizationId,
        spaceId,
        tokens: {
          accessToken: 'x',
          refreshToken: null,
          expiresIn: null,
          scope: null,
        },
        whoami: { id: 'usrABC', scopes: [] },
        bases: [],
      }),
    ).rejects.toThrow(/platform row missing/i)
  })
})

describe('getIntegrationsState (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('returns an empty payload (with starter cap) for a space with no connections', async () => {
    const { organizationId, spaceId } = await seedFixture()
    const state = await getIntegrationsState(db, organizationId, spaceId)
    expect(state).toEqual({
      connections: [],
      bases: [],
      tierBasesPerSpace: 5,
      hasBackupConfig: false,
    })
  })

  it('reports the resolved tier cap when a subscription exists', async () => {
    const { organizationId, spaceId } = await seedFixture()
    const [{ id: platformId }] = await db
      .select({ id: platforms.id })
      .from(platforms)
      .where(eq(platforms.slug, 'airtable'))
      .limit(1)
    await seedSubscriptionItem(organizationId, { tier: 'pro', platformId })

    const state = await getIntegrationsState(db, organizationId, spaceId)
    expect(state.tierBasesPerSpace).toBe(25)
  })

  it('marks bases as included when a backup configuration selects them', async () => {
    const { userId, organizationId, spaceId } = await seedFixture()
    await persistAirtableConnection(db, KEY, {
      userId,
      organizationId,
      spaceId,
      tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600, scope: 'data.records:read' },
      whoami: { id: 'usrABC', scopes: ['data.records:read'] },
      bases: [
        { id: 'appOne', name: 'Base One', permissionLevel: 'create' },
        { id: 'appTwo', name: 'Base Two', permissionLevel: 'edit' },
      ],
    })
    const [appOne] = await db
      .select({ id: atBases.id })
      .from(atBases)
      .where(eq(atBases.atBaseId, 'appOne'))
      .limit(1)
    await persistBaseSelection(db, {
      spaceId,
      toEnable: [appOne.id],
      toDisable: [],
    })

    const state = await getIntegrationsState(db, organizationId, spaceId)
    expect(state.hasBackupConfig).toBe(true)
    const byAtBaseId = Object.fromEntries(state.bases.map((b) => [b.atBaseId, b.isIncluded]))
    expect(byAtBaseId).toEqual({ appOne: true, appTwo: false })
  })

  it('surfaces persisted connection + bases in a client-safe shape', async () => {
    const { userId, organizationId, spaceId } = await seedFixture()
    await persistAirtableConnection(db, KEY, {
      userId,
      organizationId,
      spaceId,
      tokens: {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 3600,
        scope: 'data.records:read',
      },
      whoami: { id: 'usrABC', scopes: ['data.records:read'] },
      bases: [
        { id: 'appOne', name: 'Base One', permissionLevel: 'create' },
        { id: 'appTwo', name: 'Base Two', permissionLevel: 'edit' },
      ],
    })

    const state = await getIntegrationsState(db, organizationId, spaceId)
    expect(state.connections).toHaveLength(1)
    const conn = state.connections[0]
    expect(conn.platformSlug).toBe('airtable')
    expect(conn.platformName).toBe('Airtable')
    expect(conn.status).toBe('active')
    expect(conn.airtableUserId).toBe('usrABC')
    expect(conn.isEnterprise).toBe(false)
    expect(conn.basesCount).toBe(2)

    // No ciphertext leaks in the client-safe shape.
    const serialized = JSON.stringify(state)
    expect(serialized).not.toContain('access_token')
    expect(serialized).not.toContain('refresh_token')
    expect(serialized).not.toContain('_enc')

    expect(state.bases.map((b) => b.atBaseId)).toEqual(['appOne', 'appTwo'])
    expect(state.tierBasesPerSpace).toBe(5)        // no subscription → starter fallback
    expect(state.hasBackupConfig).toBe(false)
    state.bases.forEach((b) => expect(b.isIncluded).toBe(false))
  })
})
