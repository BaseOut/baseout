import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { randomBytes, randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { createDb } from '../../src/db'
import {
  organizationMembers,
  organizations,
  spaces,
  userPreferences,
  users,
} from '../../src/db/schema'
import {
  createSpaceForOrg,
  listSpacesForOrg,
  switchActiveSpace,
} from '../../src/lib/spaces'

const { db } = createDb(env.HYPERDRIVE.connectionString)

async function resetBaseoutTables(): Promise<void> {
  await db.execute(
    sql.raw(
      `TRUNCATE TABLE
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
    name: 'Production',
  })
  await db.insert(userPreferences).values({
    userId,
    activeOrganizationId: organizationId,
    activeSpaceId: spaceId,
  })

  return { userId, organizationId, spaceId }
}

describe('createSpaceForOrg (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('inserts a shell Space with defaults and sets it as the active Space', async () => {
    const { userId, organizationId } = await seedFixture()

    const created = await createSpaceForOrg(db, {
      userId,
      organizationId,
      name: 'Staging',
    })

    expect(typeof created.id).toBe('string')
    expect(created.name).toBe('Staging')

    const [row] = await db.select().from(spaces).where(eq(spaces.id, created.id))
    expect(row.organizationId).toBe(organizationId)
    expect(row.name).toBe('Staging')
    expect(row.status).toBe('setup_incomplete')
    expect(row.spaceType).toBe('single_platform')
    expect(row.onboardingStep).toBe(1)

    const [prefs] = await db
      .select({ activeSpaceId: userPreferences.activeSpaceId })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
    expect(prefs.activeSpaceId).toBe(created.id)
  })

  it('trims surrounding whitespace from the name', async () => {
    const { userId, organizationId } = await seedFixture()
    const { name } = await createSpaceForOrg(db, {
      userId,
      organizationId,
      name: '  Staging  ',
    })
    expect(name).toBe('Staging')
  })

  it('rejects a blank name with an invalid SpaceError on field "name"', async () => {
    const { userId, organizationId } = await seedFixture()
    await expect(
      createSpaceForOrg(db, { userId, organizationId, name: '   ' }),
    ).rejects.toMatchObject({
      detail: { kind: 'invalid', field: 'name' },
    })
  })

  it('rejects a name longer than 100 characters', async () => {
    const { userId, organizationId } = await seedFixture()
    await expect(
      createSpaceForOrg(db, {
        userId,
        organizationId,
        name: 'x'.repeat(101),
      }),
    ).rejects.toMatchObject({
      detail: { kind: 'invalid', field: 'name' },
    })
  })

  it('upserts user_preferences for a user with no existing prefs row', async () => {
    const { organizationId } = await seedFixture()

    const otherUserId = randomUUID()
    await db.insert(users).values({
      id: otherUserId,
      name: 'Other',
      email: `other-${otherUserId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await db.insert(organizationMembers).values({
      organizationId,
      userId: otherUserId,
      role: 'member',
    })

    const created = await createSpaceForOrg(db, {
      userId: otherUserId,
      organizationId,
      name: 'SecondSpace',
    })

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, otherUserId))
    expect(prefs.activeOrganizationId).toBe(organizationId)
    expect(prefs.activeSpaceId).toBe(created.id)
  })
})

describe('listSpacesForOrg (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('returns an empty array for an org with no Spaces', async () => {
    const organizationId = randomUUID()
    await db.insert(organizations).values({
      id: organizationId,
      name: 'Empty Org',
      slug: `empty-${randomBytes(4).toString('hex')}`,
    })

    const rows = await listSpacesForOrg(db, organizationId)
    expect(rows).toEqual([])
  })

  it('returns Spaces for the given org ordered by createdAt', async () => {
    const { organizationId, spaceId } = await seedFixture()

    const [second] = await db
      .insert(spaces)
      .values({ organizationId, name: 'Staging', status: 'active' })
      .returning({ id: spaces.id })
    const [third] = await db
      .insert(spaces)
      .values({ organizationId, name: 'Development' })
      .returning({ id: spaces.id })

    const rows = await listSpacesForOrg(db, organizationId)
    expect(rows.map((r) => r.id)).toEqual([spaceId, second.id, third.id])
    expect(rows.map((r) => r.name)).toEqual(['Production', 'Staging', 'Development'])
    expect(rows.find((r) => r.id === second.id)?.status).toBe('active')
  })

  it('scopes results to the requested org', async () => {
    const { organizationId } = await seedFixture()

    const otherOrgId = randomUUID()
    await db.insert(organizations).values({
      id: otherOrgId,
      name: 'Other Org',
      slug: `other-${randomBytes(4).toString('hex')}`,
    })
    await db.insert(spaces).values({ organizationId: otherOrgId, name: 'Noise' })

    const rows = await listSpacesForOrg(db, organizationId)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Production')
  })
})

describe('switchActiveSpace (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('updates user_preferences.activeSpaceId for a Space in the same Org', async () => {
    const { userId, organizationId, spaceId } = await seedFixture()

    const [second] = await db
      .insert(spaces)
      .values({ organizationId, name: 'Staging' })
      .returning({ id: spaces.id })

    await switchActiveSpace(db, {
      userId,
      organizationId,
      spaceId: second.id,
    })

    const [prefs] = await db
      .select({ activeSpaceId: userPreferences.activeSpaceId })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
    expect(prefs.activeSpaceId).toBe(second.id)

    const originals = await db.select().from(spaces).where(eq(spaces.id, spaceId))
    expect(originals).toHaveLength(1)
  })

  it('throws forbidden when the Space belongs to a different Organization', async () => {
    const { userId, organizationId } = await seedFixture()

    const otherOrgId = randomUUID()
    await db.insert(organizations).values({
      id: otherOrgId,
      name: 'Other Org',
      slug: `other-${randomBytes(4).toString('hex')}`,
    })
    const [otherSpace] = await db
      .insert(spaces)
      .values({ organizationId: otherOrgId, name: 'OtherSpace' })
      .returning({ id: spaces.id })

    await expect(
      switchActiveSpace(db, {
        userId,
        organizationId,
        spaceId: otherSpace.id,
      }),
    ).rejects.toMatchObject({
      detail: { kind: 'forbidden' },
    })
  })

  it('throws forbidden when the spaceId does not exist', async () => {
    const { userId, organizationId } = await seedFixture()

    await expect(
      switchActiveSpace(db, {
        userId,
        organizationId,
        spaceId: randomUUID(),
      }),
    ).rejects.toMatchObject({
      detail: { kind: 'forbidden' },
    })
  })
})
