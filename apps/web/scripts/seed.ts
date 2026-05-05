/**
 * Seed script — idempotent test data for local development.
 *
 * Inserts a user + onboarded Organization + Space via Drizzle. With password
 * auth removed, there is no credential to seed — the user signs in locally
 * via magic-link (dev mode logs the URL to the worker console).
 *
 * Usage:  npm run seed
 */

import { db, sql } from '../src/db/node'
import {
  users,
  platforms,
  organizations,
  organizationMembers,
  spaces,
  spacePlatforms,
  userPreferences,
} from '../src/db/schema'
import { eq, sql as dsql } from 'drizzle-orm'

const SEED_USER = {
  name: 'Autumn Shakespeare',
  email: 'autumn@openside.com',
}

async function seed() {
  console.log('Seeding database...\n')

  // ── 1. User ───────────────────────────────────────────
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SEED_USER.email))
    .limit(1)

  let userId: string

  if (existing) {
    userId = existing.id
    console.log('  User already exists:', SEED_USER.email)
    await db
      .update(users)
      .set({
        emailVerified: true,
        termsAcceptedAt: dsql`now()`,
        updatedAt: dsql`now()`,
      })
      .where(eq(users.id, userId))
  } else {
    const [inserted] = await db
      .insert(users)
      .values({
        name: SEED_USER.name,
        email: SEED_USER.email,
        emailVerified: true,
        termsAcceptedAt: dsql`now()`,
        createdAt: dsql`now()`,
        updatedAt: dsql`now()`,
      })
      .returning({ id: users.id })
    userId = inserted.id
    console.log('  Created user:', SEED_USER.email)
  }

  // ── 2. Platform (Airtable) ────────────────────────────
  const [platform] = await db
    .insert(platforms)
    .values({
      slug: 'airtable',
      code: 'at',
      name: 'Airtable',
      websiteUrl: 'https://airtable.com',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: platforms.slug,
      set: { name: 'Airtable', code: 'at' },
    })
    .returning()

  console.log('  Platform:', platform.name)

  // ── 3. Organization ───────────────────────────────────
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Openside',
      slug: 'openside',
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: 'Openside' },
    })
    .returning()

  console.log('  Organization:', org.name)

  // ── 4. Organization membership ────────────────────────
  await db
    .insert(organizationMembers)
    .values({
      organizationId: org.id,
      userId,
      role: 'owner',
      isDefault: true,
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role: 'owner', isDefault: true },
    })

  console.log('  Membership: owner')

  // ── 5. Space ──────────────────────────────────────────
  //    No unique constraint on (org, name), so select-or-insert.
  const [existingSpace] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.organizationId, org.id))
    .limit(1)

  const space =
    existingSpace ??
    (
      await db
        .insert(spaces)
        .values({
          organizationId: org.id,
          name: 'Airtable Backup',
          status: 'active',
          onboardingStep: 5,
          onboardingCompletedAt: new Date(),
        })
        .returning()
    )[0]

  console.log('  Space:', space.name)

  // ── 6. Space ↔ Platform link ──────────────────────────
  await db
    .insert(spacePlatforms)
    .values({ spaceId: space.id, platformId: platform.id })
    .onConflictDoNothing()

  console.log('  Space platform: linked')

  // ── 7. User preferences ───────────────────────────────
  await db
    .insert(userPreferences)
    .values({
      userId,
      activeOrganizationId: org.id,
      activeSpaceId: space.id,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        activeOrganizationId: org.id,
        activeSpaceId: space.id,
      },
    })

  console.log('  Preferences: set\n')

  console.log('Seed complete!')
  console.log(`  Sign in at /login with: ${SEED_USER.email}`)
  console.log(`  Magic-link URL prints to the worker console in dev.\n`)

  await sql.end()
}

seed().catch(async (err) => {
  console.error('Seed failed:', err)
  await sql.end()
  process.exit(1)
})
