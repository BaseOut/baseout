/**
 * Function-level integration tests for src/middleware.ts.
 *
 * Pool-workers can't route HTTP requests through the Astro stack, so these
 * tests construct a minimum-viable Astro APIContext (see makeAstroContext)
 * and call the middleware function directly. The astro:middleware virtual
 * module is mocked because pool-workers doesn't ship Astro's vite plugin.
 *
 * The middleware exercises real Postgres + real Better Auth, so coverage
 * here is true integration even without HTTP routing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('astro:middleware', () => ({
  // defineMiddleware is just a typed identity wrapper at runtime.
  defineMiddleware: <T>(fn: T): T => fn,
}))

import {
  db,
  makeAstroContext,
  resetBaseoutTables,
  seedAuthedUser,
  seedOrgWithMembership,
} from './setup/testHarness'
import { SESSION_CACHE } from '../../src/lib/session-cache'

// Imported for its side effect (registering the mock); also gives us the
// onRequest export.
const { onRequest } = await import('../../src/middleware')

function makeNext(body = 'next-called') {
  return vi.fn(async () => new Response(body, { status: 200 }))
}

// Middleware returns `Promise<void | Response>` (void when next() doesn't
// produce one, which our mock always does). Cast to Response at the call
// site since every test asserts on the response shape.
async function run(
  ctx: ReturnType<typeof makeAstroContext>,
  next: ReturnType<typeof makeNext>,
): Promise<Response> {
  return (await onRequest(ctx as never, next)) as Response
}

describe('middleware (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
    SESSION_CACHE.clear()
  })
  afterEach(() => {
    SESSION_CACHE.clear()
  })

  describe('public routes — pass through without auth', () => {
    it('allows /login without a session', async () => {
      const ctx = makeAstroContext({ url: '/login' })
      const next = makeNext()
      const res = await run(ctx, next)
      expect(next).toHaveBeenCalledOnce()
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('next-called')
    })

    it('allows /register without a session', async () => {
      const ctx = makeAstroContext({ url: '/register' })
      const next = makeNext()
      const res = await run(ctx, next)
      expect(next).toHaveBeenCalledOnce()
      expect(res.status).toBe(200)
    })

    it('allows /api/auth/* without a session', async () => {
      const ctx = makeAstroContext({ url: '/api/auth/sign-in/magic-link', method: 'POST' })
      const next = makeNext()
      const res = await run(ctx, next)
      expect(next).toHaveBeenCalledOnce()
      expect(res.status).toBe(200)
    })
  })

  describe('protected routes without session', () => {
    it('redirects unauthed page request to /login', async () => {
      const ctx = makeAstroContext({ url: '/' })
      const next = makeNext()
      const res = await run(ctx, next)
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')
    })

    it('returns 401 JSON for unauthed API request', async () => {
      const ctx = makeAstroContext({ url: '/api/me' })
      const next = makeNext()
      const res = await run(ctx, next)
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toBe(401)
      expect(res.headers.get('content-type')).toMatch(/application\/json/)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Not authenticated')
    })
  })

  describe('protected routes with valid session', () => {
    it('populates locals.user/.session/.account and calls next() for an onboarded user', async () => {
      const { userId, cookieHeader } = await seedAuthedUser() // termsAcceptedAt defaults to now
      await seedOrgWithMembership(userId)

      const ctx = makeAstroContext({ url: '/', cookieHeader })
      const next = makeNext()
      const res = await run(ctx, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).toBe(200)
      expect(ctx.locals.user).toMatchObject({ id: userId })
      expect(ctx.locals.session).toBeTruthy()
      expect(ctx.locals.account).toMatchObject({
        user: { id: userId },
        organization: expect.objectContaining({ id: expect.any(String) }),
        space: expect.objectContaining({ id: expect.any(String) }),
      })
    })

    it('redirects /login → / when already authed', async () => {
      const { userId, cookieHeader } = await seedAuthedUser()
      await seedOrgWithMembership(userId)

      const ctx = makeAstroContext({ url: '/login', cookieHeader })
      const next = makeNext()
      const res = await run(ctx, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/')
    })
  })

  describe('onboarding gate', () => {
    it('redirects authed-but-not-onboarded user to /welcome on a page route', async () => {
      const { userId, cookieHeader } = await seedAuthedUser({ termsAcceptedAt: null })
      await seedOrgWithMembership(userId)

      const ctx = makeAstroContext({ url: '/', cookieHeader })
      const next = makeNext()
      const res = await run(ctx, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/welcome')
    })

    it('returns 403 JSON for authed-but-not-onboarded user on a non-exempt API route', async () => {
      const { userId, cookieHeader } = await seedAuthedUser({ termsAcceptedAt: null })
      await seedOrgWithMembership(userId)

      const ctx = makeAstroContext({ url: '/api/me', cookieHeader })
      const next = makeNext()
      const res = await run(ctx, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toBe(403)
      expect(res.headers.get('content-type')).toMatch(/application\/json/)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Onboarding incomplete')
    })

    it('allows /welcome for authed-but-not-onboarded user', async () => {
      const { userId, cookieHeader } = await seedAuthedUser({ termsAcceptedAt: null })
      await seedOrgWithMembership(userId)

      const ctx = makeAstroContext({ url: '/welcome', cookieHeader })
      const next = makeNext()
      const res = await run(ctx, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).toBe(200)
    })

    it('allows /api/onboarding/complete for authed-but-not-onboarded user', async () => {
      const { userId, cookieHeader } = await seedAuthedUser({ termsAcceptedAt: null })
      await seedOrgWithMembership(userId)

      const ctx = makeAstroContext({ url: '/api/onboarding/complete', method: 'POST', cookieHeader })
      const next = makeNext()
      const res = await run(ctx, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).toBe(200)
    })

    it('redirects authed-and-onboarded user away from /welcome', async () => {
      const { userId, cookieHeader } = await seedAuthedUser() // termsAcceptedAt defaults to now
      await seedOrgWithMembership(userId)

      const ctx = makeAstroContext({ url: '/welcome', cookieHeader })
      const next = makeNext()
      const res = await run(ctx, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/')
    })
  })

  // Reference db so the unused-import linter doesn't complain when running
  // these tests in isolation.
  void db
})
