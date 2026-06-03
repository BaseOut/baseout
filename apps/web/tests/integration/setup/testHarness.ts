/**
 * Shared utilities for integration tests in tests/integration/.
 *
 * Module-scoped `db` per pool-workers convention (one connection per file
 * isolate, never `sql.end()` — see memory feedback_postgres_cf_test_teardown).
 */

import { env } from 'cloudflare:workers'
import { randomBytes, randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { createDb } from '../../../src/db'
import {
  accounts,
  atBases,
  connections,
  organizationMembers,
  organizations,
  platforms,
  sessions,
  spaces,
  subscriptionItems,
  subscriptions,
  userPreferences,
  users,
  verifications,
} from '../../../src/db/schema'
import { createAuth } from '../../../src/lib/auth-factory'
import type { Tier } from '../../../src/lib/capabilities/tier-capabilities'

export const { db } = createDb(env.HYPERDRIVE.connectionString)

/**
 * TRUNCATE every Baseout-touched table. Mirrors the list used by
 * tests/integration/spaces.test.ts so the harness works for any
 * integration suite.
 */
export async function resetBaseoutTables(): Promise<void> {
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

// ———————————————————————————————————————————————————————————————————————————
// User / org / space / session seeders
// ———————————————————————————————————————————————————————————————————————————

export interface UserSeed {
  userId: string
  email: string
  name: string
}

export async function seedUser(opts?: {
  email?: string
  name?: string
  emailVerified?: boolean
  termsAcceptedAt?: Date | null
}): Promise<UserSeed> {
  const userId = randomUUID()
  const email = opts?.email ?? `test-${userId}@example.invalid`
  const name = opts?.name ?? 'Test User'
  const now = new Date()
  await db.insert(users).values({
    id: userId,
    name,
    email,
    emailVerified: opts?.emailVerified ?? true,
    termsAcceptedAt: opts?.termsAcceptedAt ?? now,
    createdAt: now,
    updatedAt: now,
  })
  return { userId, email, name }
}

export interface OrgSeed {
  organizationId: string
  spaceId: string
  slug: string
}

export async function seedOrgWithMembership(
  userId: string,
  opts?: { role?: string; isDefault?: boolean; spaceName?: string },
): Promise<OrgSeed> {
  const organizationId = randomUUID()
  const spaceId = randomUUID()
  const slug = `org-${randomBytes(4).toString('hex')}`
  await db.insert(organizations).values({
    id: organizationId,
    name: 'Test Org',
    slug,
  })
  await db.insert(organizationMembers).values({
    organizationId,
    userId,
    role: opts?.role ?? 'owner',
    isDefault: opts?.isDefault ?? true,
  })
  await db.insert(spaces).values({
    id: spaceId,
    organizationId,
    name: opts?.spaceName ?? 'Production',
  })
  await db.insert(userPreferences).values({
    userId,
    activeOrganizationId: organizationId,
    activeSpaceId: spaceId,
  })
  return { organizationId, spaceId, slug }
}

/**
 * Mints a real Better Auth session by running the full magic-link
 * sign-in roundtrip (signInMagicLink → click verify URL → capture
 * Set-Cookie). The returned cookieHeader carries the signed
 * `better-auth.session_token` cookie, so middleware tests exercise the
 * same signature/HMAC path as a live user.
 *
 * `termsAcceptedAt` defaults to `now` (onboarded). Pass `null` to
 * simulate a user who finished sign-in but hasn't accepted terms.
 *
 * Only the `session_token` cookie is forwarded — the `session_data`
 * cookie cache is intentionally dropped so post-mint user patches
 * (e.g. termsAcceptedAt) are seen by `auth.api.getSession()` on the
 * very next request.
 */
export interface AuthedUserSeed {
  userId: string
  email: string
  cookieHeader: string
}

export async function seedAuthedUser(opts?: {
  email?: string
  termsAcceptedAt?: Date | null
}): Promise<AuthedUserSeed> {
  const baseUrl = 'https://baseout.dev'
  const email = opts?.email ?? `test-${randomUUID()}@example.invalid`
  const emailBinding = makeMockEmailBinding()
  const auth = createAuth(db, {
    secret: 'test-only-secret-min-32-chars-aaaaaaaaaaaa',
    email: emailBinding.binding,
    from: 'Baseout Test <test@example.invalid>',
    baseUrl,
    dev: false,
  })

  await auth.api.signInMagicLink({
    body: { email, callbackURL: '/' },
    headers: new Headers(),
  })
  const magicLinkUrl = emailBinding.captured[0]?.magicLinkUrl
  if (!magicLinkUrl) {
    throw new Error('seedAuthedUser: mock email binding captured no magic link URL')
  }

  const callbackRes = await auth.handler(
    new Request(magicLinkUrl, {
      method: 'GET',
      headers: { Origin: baseUrl },
      redirect: 'manual',
    }),
  )

  const setCookie = callbackRes.headers.get('set-cookie') ?? ''
  const cookieHeader = setCookieToCookieHeader(setCookie)
  if (!cookieHeader) {
    throw new Error(
      `seedAuthedUser: no session_token in Set-Cookie after magic-link verify (status=${callbackRes.status})`,
    )
  }

  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user) {
    throw new Error('seedAuthedUser: magic-link flow did not persist a user row')
  }

  const termsAcceptedAt =
    opts?.termsAcceptedAt === undefined ? new Date() : opts.termsAcceptedAt
  await db.update(users).set({ termsAcceptedAt }).where(eq(users.id, user.id))

  return { userId: user.id, email, cookieHeader }
}

// ———————————————————————————————————————————————————————————————————————————
// Mock EMAIL send_email binding (captures sends, parses magic-link URL)
// ———————————————————————————————————————————————————————————————————————————

export interface CapturedEmail {
  to: string
  subject: string
  magicLinkUrl: string | null
  raw: {
    from: string
    to: string
    subject: string
    html: string
    text: string
  }
}

export interface MockEmailBinding {
  binding: {
    send: (msg: {
      from: string
      to: string
      subject: string
      html: string
      text: string
    }) => Promise<{ messageId: string }>
  }
  captured: CapturedEmail[]
  drain: () => CapturedEmail[]
}

export function makeMockEmailBinding(): MockEmailBinding {
  const captured: CapturedEmail[] = []
  return {
    captured,
    drain() {
      const out = captured.slice()
      captured.length = 0
      return out
    },
    binding: {
      async send(msg) {
        const urlMatch = msg.text.match(/https?:\/\/\S+/)
        captured.push({
          to: msg.to,
          subject: msg.subject,
          magicLinkUrl: urlMatch ? urlMatch[0] : null,
          raw: msg,
        })
        return { messageId: `test-${randomBytes(6).toString('hex')}` }
      },
    },
  }
}

// ———————————————————————————————————————————————————————————————————————————
// Astro middleware test context
//
// Builds a minimum-viable APIContext-shaped object that satisfies the
// fields src/middleware.ts actually reads/writes. Not a full Astro mock —
// scoped to what middleware needs.
// ———————————————————————————————————————————————————————————————————————————

export interface AstroContextOpts {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  cookieHeader?: string
}

export interface MockAstroContext {
  url: URL
  request: Request
  locals: Record<string, unknown> & {
    cfContext: { waitUntil: (p: Promise<unknown>) => void }
  }
  redirect: (path: string, status?: number) => Response
}

export function makeAstroContext(opts: AstroContextOpts): MockAstroContext {
  const url = new URL(opts.url, 'https://baseout.dev')
  const headers = new Headers(opts.headers)
  if (opts.cookieHeader) headers.set('cookie', opts.cookieHeader)
  const request = new Request(url, {
    method: opts.method ?? 'GET',
    headers,
  })
  return {
    url,
    request,
    locals: {
      cfContext: {
        waitUntil(p) {
          // Swallow rejections from sql.end so background teardown errors
          // don't surface as unhandled rejections in the vitest worker.
          if (p && typeof (p as Promise<unknown>).catch === 'function') {
            (p as Promise<unknown>).catch(() => {})
          }
        },
      },
    },
    redirect(path, status = 302) {
      return new Response(null, {
        status,
        headers: { location: path },
      })
    },
  }
}

/**
 * Fire-and-forget helper: pulls a token out of a Set-Cookie response and
 * builds the matching Cookie header string for the next request.
 */
export function setCookieToCookieHeader(setCookie: string | null): string | null {
  if (!setCookie) return null
  const m = setCookie.match(
    /(?:^|,\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/,
  )
  return m ? `better-auth.session_token=${m[1]}` : null
}

// Unused-import guards — these tables are referenced indirectly via the
// TRUNCATE statement above, but the imports keep them part of the test
// build graph so a schema rename triggers a compile error here.
void accounts
void sessions
void verifications

// ———————————————————————————————————————————————————————————————————————————
// Subscription / platform seeders
// ———————————————————————————————————————————————————————————————————————————

/**
 * Insert the Airtable platforms row. Call once per beforeEach after
 * resetBaseoutTables (the TRUNCATE clears any prior row); a second call
 * within the same test will hit the slug unique constraint.
 */
export async function seedAirtablePlatform(): Promise<{ platformId: string }> {
  const platformId = randomUUID()
  await db.insert(platforms).values({
    id: platformId,
    slug: 'airtable',
    code: 'at',
    name: 'Airtable',
    websiteUrl: 'https://airtable.com',
  })
  return { platformId }
}

/**
 * Seed a subscription + subscription_item for an org at a given tier.
 * Mirrors what Stripe webhooks would write in production.
 */
export async function seedSubscriptionItem(
  organizationId: string,
  opts: { tier: Tier; platformId: string; billingPeriod?: 'monthly' | 'annual'; status?: string },
): Promise<{ subscriptionId: string; subscriptionItemId: string }> {
  const subscriptionId = randomUUID()
  const subscriptionItemId = randomUUID()
  await db.insert(subscriptions).values({
    id: subscriptionId,
    organizationId,
    stripeSubscriptionId: `sub_test_${randomUUID()}`,
    status: opts.status ?? 'active',
  })
  await db.insert(subscriptionItems).values({
    id: subscriptionItemId,
    subscriptionId,
    platformId: opts.platformId,
    stripeSubscriptionItemId: `si_test_${randomUUID()}`,
    stripeProductId: `prod_test_${opts.tier}`,
    stripePriceId: `price_test_${opts.tier}`,
    tier: opts.tier,
    billingPeriod: opts.billingPeriod ?? 'monthly',
  })
  return { subscriptionId, subscriptionItemId }
}

// ———————————————————————————————————————————————————————————————————————————
// at_bases seeder
// ———————————————————————————————————————————————————————————————————————————

export async function seedAtBase(
  spaceId: string,
  opts: { atBaseId: string; name: string },
): Promise<{ atBaseRowId: string }> {
  const atBaseRowId = randomUUID()
  await db.insert(atBases).values({
    id: atBaseRowId,
    spaceId,
    atBaseId: opts.atBaseId,
    name: opts.name,
    lastSeenAt: new Date(),
  })
  return { atBaseRowId }
}

// ———————————————————————————————————————————————————————————————————————————
// connections seeder
// ———————————————————————————————————————————————————————————————————————————

/**
 * Insert an org-scoped Airtable connection. The accessTokenEnc is a fake
 * placeholder; the engine reads tokens via its own helpers, but the DB column
 * is NOT NULL so seeds must populate it.
 */
export async function seedConnection(opts: {
  organizationId: string
  platformId: string
  createdByUserId: string
  status?: 'active' | 'invalid' | 'refreshing' | 'pending_reauth'
  scope?: 'user' | 'organization' | 'space'
  spaceId?: string
}): Promise<{ connectionId: string }> {
  const connectionId = randomUUID()
  await db.insert(connections).values({
    id: connectionId,
    organizationId: opts.organizationId,
    platformId: opts.platformId,
    createdByUserId: opts.createdByUserId,
    scope: opts.scope ?? 'organization',
    spaceId: opts.spaceId,
    accessTokenEnc: 'test-fake-encrypted-token',
    status: opts.status ?? 'active',
  })
  return { connectionId }
}
