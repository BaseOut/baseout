import { afterEach, describe, expect, it } from 'vitest'
import {
  expiredSessionDataCookies,
  extractSessionTokenCookie,
  invalidateSessionCache,
  SESSION_CACHE,
  SESSION_TTL_MS,
  sessionCacheRequest,
  parseCachedAuthPayload,
  type CachedAuth,
} from './session-cache'

function seed(token: string): CachedAuth {
  const entry: CachedAuth = {
    user: null,
    session: null,
    account: null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
  SESSION_CACHE.set(token, entry)
  return entry
}

afterEach(() => {
  SESSION_CACHE.clear()
})

describe('extractSessionTokenCookie', () => {
  it('returns the value of the better-auth.session_token cookie', () => {
    expect(
      extractSessionTokenCookie('foo=bar; better-auth.session_token=abc123; baz=qux'),
    ).toBe('abc123')
  })

  it('returns the __Secure- prefixed variant (prod cookie name)', () => {
    expect(extractSessionTokenCookie('__Secure-better-auth.session_token=xyz789')).toBe(
      'xyz789',
    )
  })

  it('returns null when the cookie is absent', () => {
    expect(extractSessionTokenCookie('foo=bar; baz=qux')).toBeNull()
    expect(extractSessionTokenCookie('')).toBeNull()
  })

  it('does not match a cookie whose name merely contains the token', () => {
    // Guards against partial-name collisions like "x-better-auth.session_token=".
    expect(
      extractSessionTokenCookie('x-better-auth.session_token=should-not-match'),
    ).toBeNull()
  })
})

describe('invalidateSessionCache', () => {
  it('removes an existing entry', () => {
    seed('tok-a')
    expect(SESSION_CACHE.has('tok-a')).toBe(true)
    invalidateSessionCache('tok-a')
    expect(SESSION_CACHE.has('tok-a')).toBe(false)
  })

  it('is a no-op when the token is null or empty', () => {
    seed('tok-b')
    invalidateSessionCache(null)
    invalidateSessionCache('')
    expect(SESSION_CACHE.has('tok-b')).toBe(true)
  })

  it('is a no-op when the token is not in the cache', () => {
    seed('tok-c')
    invalidateSessionCache('different-token')
    expect(SESSION_CACHE.has('tok-c')).toBe(true)
  })

  it('only removes the entry for the given token', () => {
    seed('tok-d')
    seed('tok-e')
    invalidateSessionCache('tok-d')
    expect(SESSION_CACHE.has('tok-d')).toBe(false)
    expect(SESSION_CACHE.has('tok-e')).toBe(true)
  })
})

describe('session Cache API key', () => {
  it('hashes the token so the raw cookie is not the cache URL', async () => {
    const req = await sessionCacheRequest('secret-token')
    expect(req.url).not.toContain('secret-token')
    expect((await sessionCacheRequest('secret-token')).url).toBe(req.url)
    expect((await sessionCacheRequest('other-token')).url).not.toBe(req.url)
  })

  it('round-trips a cached auth payload', () => {
    const payload = {
      user: { id: 'u1', name: 'Ada', email: 'ada@openside.com', image: null, termsAcceptedAt: null },
      session: { id: 's1', userId: 'u1' },
      account: null,
    }
    expect(parseCachedAuthPayload(JSON.stringify(payload))).toEqual(payload)
    expect(parseCachedAuthPayload('not-json')).toBeNull()
    expect(parseCachedAuthPayload('{}')).toBeNull()
  })

  it('expires both session_data cookie variants (plain local + __Secure- deployed)', () => {
    const cookies = expiredSessionDataCookies()
    expect(cookies).toHaveLength(2)
    const plain = cookies.find((c) => c.startsWith('better-auth.session_data='))
    const secure = cookies.find((c) => c.startsWith('__Secure-better-auth.session_data='))
    expect(plain).toContain('Max-Age=0')
    expect(plain).toContain('Path=/')
    expect(secure).toContain('Max-Age=0')
    expect(secure).toContain('Path=/')
    // __Secure- prefixed cookies are rejected by browsers without Secure.
    expect(secure).toContain('Secure')
  })
})
