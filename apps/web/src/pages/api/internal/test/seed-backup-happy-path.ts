/**
 * POST /api/internal/test/seed-backup-happy-path
 *   ?email=e2e-<suffix>@<domain>
 *
 * DEV/TEST-ONLY: idempotently provisions a fully-onboarded user with an
 * active Airtable connection and one base selected, so the Playwright
 * backup-happy-path spec can skip the OAuth + onboarding choreography and
 * focus on the click-to-run → run-row-appears regression.
 *
 * Mirrors the three-guard pattern from `last-verification.ts` (build /
 * request / input). Idempotent: re-running for the same email reuses the
 * existing chain.
 *
 * Returns: { userId, organizationId, spaceId, connectionId, atBaseId,
 *            backupConfigurationId, backupConfigurationBaseId }
 *
 * Tables touched (in dependency order):
 *   - users, organizations, organization_members, spaces,
 *     space_platforms, user_preferences,
 *     connections (status='active', accessTokenEnc='e2e-stub-token'),
 *     at_bases, backup_configurations, backup_configuration_bases
 *
 * NB: accessTokenEnc is a string placeholder — Phase 11 Option A asserts
 * up through "run row appears in widget", which never decrypts the token.
 * Phase 11 full / 10d that exercise the Trigger.dev task end-to-end will
 * need either a real stub-encrypted value or an inline-execution short-
 * circuit that swaps the decrypt for a stub.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, sql as dsql } from 'drizzle-orm'
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  connections,
  organizationMembers,
  organizations,
  platforms,
  spacePlatforms,
  spaces,
  userPreferences,
  users,
} from '../../../../db/schema'

const E2E_EMAIL_PATTERN = /^e2e-[a-z0-9-]+@[a-z0-9.-]+$/

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function verifyHmac(secret: string, payload: string, presented: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest()
  let provided: Buffer
  try {
    provided = Buffer.from(presented, 'base64')
  } catch {
    return false
  }
  if (provided.length !== expected.length) return false
  return timingSafeEqual(expected, provided)
}

export const POST: APIRoute = async ({ url, request, locals }) => {
  const workerEnv = env as unknown as {
    E2E_TEST_MODE?: string
    E2E_TEST_TOKEN?: string
  }

  // Guard 1: build-time gate.
  if (workerEnv.E2E_TEST_MODE !== 'true') return json({ error: 'forbidden' }, 403)
  const secret = workerEnv.E2E_TEST_TOKEN
  if (!secret) return json({ error: 'forbidden' }, 403)

  // Guard 3: input gate (run before HMAC to avoid validating malformed input).
  const email = url.searchParams.get('email')
  if (!email || !E2E_EMAIL_PATTERN.test(email)) {
    return json({ error: 'bad_request' }, 400)
  }

  // Guard 2: HMAC over the email value.
  const presented = request.headers.get('x-e2e-test-auth')
  if (!presented) return json({ error: 'unauthorized' }, 401)
  if (!verifyHmac(secret, email, presented)) return json({ error: 'unauthorized' }, 401)

  const db = locals.db
  if (!db) return json({ error: 'db_not_initialized' }, 500)

  // ── 1. User ───────────────────────────────────────────
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  let userId: string
  if (existingUser) {
    userId = existingUser.id
  } else {
    const [inserted] = await db
      .insert(users)
      .values({
        name: email,
        email,
        emailVerified: true,
        termsAcceptedAt: dsql`now()`,
        createdAt: dsql`now()`,
        updatedAt: dsql`now()`,
      })
      .returning({ id: users.id })
    if (!inserted) return json({ error: 'user_insert_failed' }, 500)
    userId = inserted.id
  }

  // ── 2. Airtable platform (probably already exists globally) ──
  const [platform] = await db
    .insert(platforms)
    .values({ slug: 'airtable', code: 'at', name: 'Airtable', isActive: true })
    .onConflictDoUpdate({
      target: platforms.slug,
      set: { name: 'Airtable', code: 'at' },
    })
    .returning()
  if (!platform) return json({ error: 'platform_upsert_failed' }, 500)

  // ── 3. Organization (one per E2E user; slug derived from email suffix) ──
  const orgSlug = `e2e-${userId.slice(0, 12)}`
  const [org] = await db
    .insert(organizations)
    .values({ name: `E2E ${email}`, slug: orgSlug })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: `E2E ${email}` },
    })
    .returning()
  if (!org) return json({ error: 'org_upsert_failed' }, 500)

  // ── 4. Membership ───────────────────────────────────
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

  // ── 5. Space (onboarding already complete) ──────────
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
          name: 'E2E Space',
          status: 'active',
          onboardingStep: 5,
          onboardingCompletedAt: new Date(),
        })
        .returning()
    )[0]
  if (!space) return json({ error: 'space_insert_failed' }, 500)

  // ── 6. Space ↔ Platform link ────────────────────────
  await db
    .insert(spacePlatforms)
    .values({ spaceId: space.id, platformId: platform.id })
    .onConflictDoNothing()

  // ── 7. User preferences (active org + space) ────────
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

  // ── 8. Connection (active Airtable, stub access token) ──
  // accessTokenEnc is non-null; we use a stable placeholder for E2E. The
  // value never decrypts in Option A's assertion scope (runs/start does
  // not decrypt — the Trigger.dev task does, and we don't wait for it).
  const [existingConn] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.organizationId, org.id),
        eq(connections.platformId, platform.id),
      ),
    )
    .limit(1)
  let connectionId: string
  if (existingConn) {
    connectionId = existingConn.id
    await db
      .update(connections)
      .set({ status: 'active', accessTokenEnc: 'e2e-stub-token' })
      .where(eq(connections.id, connectionId))
  } else {
    const [inserted] = await db
      .insert(connections)
      .values({
        organizationId: org.id,
        platformId: platform.id,
        createdByUserId: userId,
        scope: 'organization',
        accessTokenEnc: 'e2e-stub-token',
        status: 'active',
      })
      .returning({ id: connections.id })
    if (!inserted) return json({ error: 'connection_insert_failed' }, 500)
    connectionId = inserted.id
  }

  // ── 9. at_base (one fake Airtable base for this space) ──
  const stubAtBaseId = `appE2E${userId.slice(0, 8).toUpperCase()}`
  const [existingAtBase] = await db
    .select({ id: atBases.id })
    .from(atBases)
    .where(and(eq(atBases.spaceId, space.id), eq(atBases.atBaseId, stubAtBaseId)))
    .limit(1)
  let atBaseRowId: string
  if (existingAtBase) {
    atBaseRowId = existingAtBase.id
  } else {
    const [inserted] = await db
      .insert(atBases)
      .values({
        spaceId: space.id,
        atBaseId: stubAtBaseId,
        name: 'E2E Test Base',
      })
      .returning({ id: atBases.id })
    if (!inserted) return json({ error: 'at_base_insert_failed' }, 500)
    atBaseRowId = inserted.id
  }

  // ── 10. backup_configurations ───────────────────────
  const [existingCfg] = await db
    .select({ id: backupConfigurations.id })
    .from(backupConfigurations)
    .where(eq(backupConfigurations.spaceId, space.id))
    .limit(1)
  let configId: string
  if (existingCfg) {
    configId = existingCfg.id
  } else {
    const [inserted] = await db
      .insert(backupConfigurations)
      .values({
        spaceId: space.id,
        frequency: 'monthly',
        mode: 'static',
        storageType: 'r2_managed',
      })
      .returning({ id: backupConfigurations.id })
    if (!inserted) return json({ error: 'config_insert_failed' }, 500)
    configId = inserted.id
  }

  // ── 11. backup_configuration_bases (the FK is at_bases.id UUID, NOT
  // the Airtable identifier — see apps/server runs/start.ts join fix
  // commit 6bcaa15) ────────────────────────────────────
  const [existingCB] = await db
    .select({ id: backupConfigurationBases.id })
    .from(backupConfigurationBases)
    .where(
      and(
        eq(backupConfigurationBases.backupConfigurationId, configId),
        eq(backupConfigurationBases.atBaseId, atBaseRowId),
      ),
    )
    .limit(1)
  let configBaseId: string
  if (existingCB) {
    configBaseId = existingCB.id
    await db
      .update(backupConfigurationBases)
      .set({ isIncluded: true })
      .where(eq(backupConfigurationBases.id, configBaseId))
  } else {
    const [inserted] = await db
      .insert(backupConfigurationBases)
      .values({
        backupConfigurationId: configId,
        atBaseId: atBaseRowId,
        isIncluded: true,
      })
      .returning({ id: backupConfigurationBases.id })
    if (!inserted) return json({ error: 'config_base_insert_failed' }, 500)
    configBaseId = inserted.id
  }

  return json(
    {
      userId,
      organizationId: org.id,
      spaceId: space.id,
      connectionId,
      atBaseRowId,
      atBaseId: stubAtBaseId,
      backupConfigurationId: configId,
      backupConfigurationBaseId: configBaseId,
    },
    200,
  )
}
