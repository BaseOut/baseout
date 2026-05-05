import { afterEach, describe, expect, it } from 'vitest'
import {
  extractSessionTokenCookie,
  invalidateSessionCache,
  SESSION_CACHE,
  SESSION_TTL_MS,
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
