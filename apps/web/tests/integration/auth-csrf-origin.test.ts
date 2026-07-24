/**
 * CSRF regression guard for the embedded-iframe cookie change
 * (shared-embed-protocol Decision 9, tasks §2.2).
 *
 * To let the session flow inside an Airtable/Chrome-extension iframe, the
 * session cookie moved from SameSite=Lax to SameSite=None; Secure (see
 * resolveCookieAttributes in auth-factory.ts). SameSite=Lax was previously a
 * second, browser-enforced CSRF barrier: it kept the cookie OFF cross-site
 * POSTs. With SameSite=None the browser now DOES attach the session cookie to a
 * forged cross-site POST, so better-auth's Origin/Referer check against
 * `trustedOrigins` becomes the *sole* CSRF defense.
 *
 * These tests exercise the real better-auth stack (real Postgres, real signed
 * session cookie minted via the magic-link roundtrip) to prove that barrier
 * holds: a cookie-bearing POST from an untrusted origin is rejected 403 and has
 * no effect, while the same POST from the trusted origin succeeds. If a future
 * change loosens the origin check or trusts a wildcard, one of these fails.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createAuth } from '../../src/lib/auth-factory'
import { sessions } from '../../src/db/schema'
import { db, resetBaseoutTables, seedAuthedUser } from './setup/testHarness'

const BASE_URL = 'https://baseout.dev'
const SIGN_OUT_URL = `${BASE_URL}/api/auth/sign-out`
const EVIL_ORIGIN = 'https://evil.example'

function buildAuth() {
  // Same secret as seedAuthedUser, so the minted session-token cookie verifies.
  // dev:false → trustedOrigins is just PROD_TRUSTED_ORIGINS (https://baseout.dev).
  return createAuth(db, {
    secret: 'test-only-secret-min-32-chars-aaaaaaaaaaaa',
    email: undefined,
    from: undefined,
    baseUrl: BASE_URL,
    dev: false,
  })
}

function postSignOut(
  auth: ReturnType<typeof buildAuth>,
  opts: { origin?: string; cookieHeader?: string },
): Promise<Response> {
  const headers = new Headers()
  if (opts.origin) headers.set('Origin', opts.origin)
  if (opts.cookieHeader) headers.set('Cookie', opts.cookieHeader)
  return auth.handler(new Request(SIGN_OUT_URL, { method: 'POST', headers, redirect: 'manual' }))
}

function sessionCount(userId: string): Promise<number> {
  return db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .then((rows) => rows.length)
}

describe('CSRF origin check on the embedded-iframe session cookie (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('serves the session cookie as SameSite=None; Secure (the config under test)', () => {
    const attrs = (buildAuth().options as { advanced: { defaultCookieAttributes?: unknown } }).advanced
      .defaultCookieAttributes
    // If this ever reverts to Lax/undefined, the cookie stops riding cross-site
    // and the CSRF surface below no longer exists — this guard documents why the
    // rest of the file matters.
    expect(attrs).toEqual({ sameSite: 'none', secure: true, partitioned: false })
  })

  it('rejects a forged cross-site POST that carries the session cookie (403, no effect)', async () => {
    const auth = buildAuth()
    const { userId, cookieHeader } = await seedAuthedUser()
    expect(await sessionCount(userId)).toBe(1)

    const res = await postSignOut(auth, { origin: EVIL_ORIGIN, cookieHeader })

    expect(res.status).toBe(403)
    // The forgery must NOT have signed the user out — the session row survives.
    expect(await sessionCount(userId)).toBe(1)
  })

  it('rejects a cookie-bearing POST with no Origin/Referer header (403)', async () => {
    const auth = buildAuth()
    const { userId, cookieHeader } = await seedAuthedUser()

    const res = await postSignOut(auth, { cookieHeader })

    expect(res.status).toBe(403)
    expect(await sessionCount(userId)).toBe(1)
  })

  it('allows the same POST from the trusted first-party origin (positive control)', async () => {
    const auth = buildAuth()
    const { userId, cookieHeader } = await seedAuthedUser()

    const res = await postSignOut(auth, { origin: BASE_URL, cookieHeader })

    expect(res.status).toBe(200)
    // Proves the 403s above are origin-driven, not a blanket failure: the
    // trusted-origin request reached the handler and revoked the session.
    expect(await sessionCount(userId)).toBe(0)
  })
})
