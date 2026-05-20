/**
 * POST /api/internal/test/seed-workspace-rediscovery
 *   ?email=e2e-<suffix>@<domain>&scenario=discover_only|auto_add|tier_cap
 *
 * DEV/TEST-ONLY: idempotently provisions a workspace-rediscovery fixture so
 * the Playwright spec can drive the manual rescan flow without hitting
 * Airtable's Meta API. Mirrors the three-guard shape (build / HMAC / input)
 * from `seed-backup-happy-path` and `last-verification`.
 *
 * Scenarios (all share the same chain — user/org/space/connection/config;
 * baseline at_bases + included rows + pending stubs reset per call):
 *   - discover_only — 0 baseline included, 1 pending. auto-add OFF.
 *                     After rescan: 1 discovered / 0 auto-added / 0 blocked.
 *   - auto_add      — 1 baseline included, 1 pending. auto-add ON (under cap).
 *                     After rescan: 1 discovered / 1 auto-added / 0 blocked.
 *   - tier_cap      — 5 baseline included (== Starter cap), 1 pending.
 *                     auto-add ON but no remaining slots.
 *                     After rescan: 1 discovered / 0 auto-added / 1 blocked.
 *
 * `e2e_pending_airtable_bases` mirrors the FULL workspace listing apps/server's
 * E2E_TEST_MODE branch reads in place of `listAirtableBases()` — so the table
 * carries every baseline ID plus the new pending one. The orchestrator's
 * "fresh = listed minus known" filter then surfaces only the pending entry.
 *
 * Stub Airtable base IDs are derived from the Space UUID so re-running across
 * scenarios (or across parallel e2e users) can't collide on
 * `enableBackupConfigurationBases`'s spaceId-unscoped at_bases lookup.
 *
 * Returns: { userId, organizationId, spaceId, configurationId, pendingAtBaseIds }
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, inArray, sql as dsql } from 'drizzle-orm'
import type { AppDb } from '../../../../db/worker'
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  connections,
  e2ePendingAirtableBases,
  organizationMembers,
  organizations,
  platforms,
  spacePlatforms,
  spaces,
  userPreferences,
  users,
} from '../../../../db/schema'

const E2E_EMAIL_PATTERN = /^e2e-[a-z0-9-]+@[a-z0-9.-]+$/

export type SeedScenario = 'discover_only' | 'auto_add' | 'tier_cap'
const SCENARIOS: ReadonlySet<SeedScenario> = new Set<SeedScenario>([
  'discover_only',
  'auto_add',
  'tier_cap',
])

function isScenario(v: string | null): v is SeedScenario {
  return v !== null && SCENARIOS.has(v as SeedScenario)
}

// Per scenario: pre-rescan baseline + auto-add toggle. The pending count is
// always 1 — the test asserts the discovered/auto-added/blocked split.
const SCENARIO_SETUP: Record<
  SeedScenario,
  { baselineCount: number; autoAdd: boolean }
> = {
  discover_only: { baselineCount: 0, autoAdd: false },
  auto_add: { baselineCount: 1, autoAdd: true },
  tier_cap: { baselineCount: 5, autoAdd: true },
}

function baselineAtBaseId(spaceId: string, i: number): string {
  // Space-scoped stub so parallel e2e users don't collide on the
  // orchestrator's spaceId-unscoped atBaseId → at_bases.id SELECT
  // inside enableBackupConfigurationBases (see run-deps.ts comment).
  return `appE2EBASE${spaceId.replace(/-/g, '').slice(0, 8).toUpperCase()}${i}`
}

function pendingAtBaseId(spaceId: string): string {
  return `appE2EPEND${spaceId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

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

export interface HandleSeedInput {
  env: { E2E_TEST_MODE?: string; E2E_TEST_TOKEN?: string }
  url: URL
  headers: Headers
  db: AppDb | null
}

export async function handleSeedWorkspaceRediscovery(
  input: HandleSeedInput,
): Promise<Response> {
  // Guard 1: build-time gate.
  if (input.env.E2E_TEST_MODE !== 'true') return json({ error: 'forbidden' }, 403)
  const secret = input.env.E2E_TEST_TOKEN
  if (!secret) return json({ error: 'forbidden' }, 403)

  // Guard 3: input gate (cheap, runs before HMAC verify).
  const email = input.url.searchParams.get('email')
  if (!email || !E2E_EMAIL_PATTERN.test(email)) {
    return json({ error: 'bad_request' }, 400)
  }
  const scenarioParam = input.url.searchParams.get('scenario')
  if (!isScenario(scenarioParam)) {
    return json({ error: 'bad_request', detail: 'unknown_scenario' }, 400)
  }
  const scenario: SeedScenario = scenarioParam

  // Guard 2: HMAC over the email value (same payload as last-verification).
  const presented = input.headers.get('x-e2e-test-auth')
  if (!presented) return json({ error: 'unauthorized' }, 401)
  if (!verifyHmac(secret, email, presented)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const db = input.db
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

  // ── 2. Airtable platform (global; idempotent upsert) ──
  const [platform] = await db
    .insert(platforms)
    .values({ slug: 'airtable', code: 'at', name: 'Airtable', isActive: true })
    .onConflictDoUpdate({
      target: platforms.slug,
      set: { name: 'Airtable', code: 'at' },
    })
    .returning()
  if (!platform) return json({ error: 'platform_upsert_failed' }, 500)

  // ── 3. Organization (one per e2e user) ──
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

  // ── 4. Membership ──
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

  // ── 5. Space (onboarding already complete) ──
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

  // ── 6. Space ↔ Platform link ──
  await db
    .insert(spacePlatforms)
    .values({ spaceId: space.id, platformId: platform.id })
    .onConflictDoNothing()

  // ── 7. User preferences ──
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

  // ── 8. Active Airtable connection (non-decryptable stub token) ──
  // The token never decrypts — the E2E_TEST_MODE branch in apps/server's
  // buildRediscoveryDeps skips decryptToken entirely.
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

  // ── 9. Backup configuration (upsert; autoAddFutureBases per scenario) ──
  const { baselineCount, autoAdd } = SCENARIO_SETUP[scenario]
  const [existingCfg] = await db
    .select({ id: backupConfigurations.id })
    .from(backupConfigurations)
    .where(eq(backupConfigurations.spaceId, space.id))
    .limit(1)
  let configId: string
  if (existingCfg) {
    configId = existingCfg.id
    await db
      .update(backupConfigurations)
      .set({ autoAddFutureBases: autoAdd, frequency: 'monthly' })
      .where(eq(backupConfigurations.id, configId))
  } else {
    const [inserted] = await db
      .insert(backupConfigurations)
      .values({
        spaceId: space.id,
        frequency: 'monthly',
        mode: 'static',
        storageType: 'r2_managed',
        autoAddFutureBases: autoAdd,
      })
      .returning({ id: backupConfigurations.id })
    if (!inserted) return json({ error: 'config_insert_failed' }, 500)
    configId = inserted.id
  }

  // ── 10. Reset prior rediscovery state for this space ──
  // backup_configuration_bases FKs to at_bases.id, so it must go first.
  await db
    .delete(backupConfigurationBases)
    .where(eq(backupConfigurationBases.backupConfigurationId, configId))
  // Tear down only this seed's stub at_bases — leave any other rows alone
  // (defensive guard against future seeds in the same space).
  const allStubIds = [
    pendingAtBaseId(space.id),
    ...Array.from({ length: 10 }, (_, i) =>
      baselineAtBaseId(space.id, i + 1),
    ),
  ]
  await db
    .delete(atBases)
    .where(
      and(eq(atBases.spaceId, space.id), inArray(atBases.atBaseId, allStubIds)),
    )
  await db
    .delete(e2ePendingAirtableBases)
    .where(eq(e2ePendingAirtableBases.spaceId, space.id))

  // ── 11. Seed baseline at_bases + included backup_configuration_bases ──
  const baselineIds: string[] = []
  for (let i = 1; i <= baselineCount; i++) {
    const stubId = baselineAtBaseId(space.id, i)
    const [inserted] = await db
      .insert(atBases)
      .values({
        spaceId: space.id,
        atBaseId: stubId,
        name: `E2E Baseline Base ${i}`,
        discoveredVia: 'oauth_callback',
      })
      .returning({ id: atBases.id })
    if (!inserted) {
      return json({ error: 'baseline_at_base_insert_failed' }, 500)
    }
    baselineIds.push(inserted.id)
  }
  if (baselineIds.length > 0) {
    await db.insert(backupConfigurationBases).values(
      baselineIds.map((id) => ({
        backupConfigurationId: configId,
        atBaseId: id,
        isIncluded: true,
        isAutoDiscovered: false,
      })),
    )
  }

  // ── 12. Seed e2e_pending_airtable_bases ──
  // Holds the FULL workspace listing the engine returns under E2E_TEST_MODE
  // (baseline IDs + the new pending one). The orchestrator's known/fresh
  // filter surfaces only the pending entry as "discovered."
  const pendingStubId = pendingAtBaseId(space.id)
  const pendingRows = [
    ...Array.from({ length: baselineCount }, (_, i) => ({
      spaceId: space.id,
      atBaseId: baselineAtBaseId(space.id, i + 1),
      name: `E2E Baseline Base ${i + 1}`,
    })),
    {
      spaceId: space.id,
      atBaseId: pendingStubId,
      name: 'New Base From Workspace',
    },
  ]
  await db.insert(e2ePendingAirtableBases).values(pendingRows)

  return json(
    {
      userId,
      organizationId: org.id,
      spaceId: space.id,
      configurationId: configId,
      pendingAtBaseIds: [pendingStubId],
    },
    200,
  )
}

export const POST: APIRoute = async ({ url, request, locals }) => {
  return handleSeedWorkspaceRediscovery({
    env: env as { E2E_TEST_MODE?: string; E2E_TEST_TOKEN?: string },
    url,
    headers: request.headers,
    db: locals.db ?? null,
  })
}
