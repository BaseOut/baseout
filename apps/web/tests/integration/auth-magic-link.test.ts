/**
 * Integration tests for the magic-link auth flow.
 *
 * Builds a real Better Auth instance against real Postgres + a mock
 * EMAIL binding, exercises sign-in → email-capture → callback → session
 * cookie roundtrip without going through HTTP routing.
 *
 * env.EMAIL is intentionally not used here — pool-workers doesn't stub
 * the send_email binding, so we wire the auth instance to our own mock
 * binding via the AuthFactoryEnv `email` field.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { eq } from 'drizzle-orm'
import { createAuth } from '../../src/lib/auth-factory'
import { sessions, users, verifications } from '../../src/db/schema'
import {
  db,
  makeMockEmailBinding,
  resetBaseoutTables,
} from './setup/testHarness'

const TEST_BASE_URL = 'https://baseout.dev'

function buildAuth() {
  const email = makeMockEmailBinding()
  const auth = createAuth(db, {
    secret: 'test-only-secret-min-32-chars-aaaaaaaaaaaa',
    email: email.binding,
    from: 'Baseout Test <test@example.invalid>',
    baseUrl: TEST_BASE_URL,
    dev: false,
  })
  return { auth, email }
}

describe('magic-link sign-in (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('renders an email with a parseable callback URL on signInMagicLink', async () => {
    const { auth, email } = buildAuth()
    const targetEmail = `new-user-${Date.now()}@example.invalid`

    await auth.api.signInMagicLink({
      body: { email: targetEmail, callbackURL: '/' },
      headers: new Headers(),
    })

    expect(email.captured).toHaveLength(1)
    const sent = email.captured[0]
    expect(sent.to).toBe(targetEmail)
    expect(sent.magicLinkUrl).toBeTruthy()
    expect(sent.magicLinkUrl).toMatch(/^https:\/\/baseout\.dev\//)
    expect(sent.magicLinkUrl).toMatch(/token=/)
  })

  it('persists a verifications row keyed to the magic-link token', async () => {
    // Better Auth's magic-link plugin stores `identifier = <token>` (plain
    // by default — see node_modules/better-auth/.../magic-link/index.mjs).
    // The email lives inside the JSON-encoded `value` field. So we look up
    // by token (extracted from the magic-link URL) and assert the value
    // payload references the requested email.
    const { auth, email } = buildAuth()
    const targetEmail = `verify-${Date.now()}@example.invalid`

    await auth.api.signInMagicLink({
      body: { email: targetEmail, callbackURL: '/' },
      headers: new Headers(),
    })

    const magicLinkUrl = email.captured[0]?.magicLinkUrl
    if (!magicLinkUrl) throw new Error('mock email binding did not capture a magic link URL')
    const token = new URL(magicLinkUrl).searchParams.get('token')
    expect(token).toBeTruthy()

    const rows = await db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, token!))
    expect(rows).toHaveLength(1)
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now())

    const payload = JSON.parse(rows[0].value) as { email: string }
    expect(payload.email).toBe(targetEmail)
  })

  it('completes the roundtrip: link → session cookie + sessions row', async () => {
    const { auth, email } = buildAuth()
    const targetEmail = `roundtrip-${Date.now()}@example.invalid`

    await auth.api.signInMagicLink({
      body: { email: targetEmail, callbackURL: '/' },
      headers: new Headers(),
    })
    const magicLinkUrl = email.captured[0]?.magicLinkUrl
    if (!magicLinkUrl) throw new Error('mock email binding did not capture a magic link URL')

    const callbackReq = new Request(magicLinkUrl, {
      method: 'GET',
      headers: { Origin: TEST_BASE_URL },
      redirect: 'manual',
    })
    const callbackRes = await auth.handler(callbackReq)

    // Better Auth redirects to callbackURL on success and sets the session cookie.
    expect([200, 302]).toContain(callbackRes.status)
    const setCookie = callbackRes.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/(?:^|,\s*)(?:__Secure-)?better-auth\.session_token=/)

    // User was created and a session row landed in Postgres.
    const [user] = await db.select().from(users).where(eq(users.email, targetEmail))
    expect(user).toBeTruthy()
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
    expect(sessionRows.length).toBeGreaterThanOrEqual(1)
    expect(sessionRows[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
  })
})
