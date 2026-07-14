import { describe, it, expect } from 'vitest'
import {
  extractSessionTokenCookie,
  sessionTokenCandidates,
  decideAccess,
} from './admin-session'

describe('extractSessionTokenCookie', () => {
  it('reads the dev cookie name', () => {
    expect(
      extractSessionTokenCookie('better-auth.session_token=abc.def; other=1'),
    ).toBe('abc.def')
  })

  it('reads the __Secure- prod variant', () => {
    expect(
      extractSessionTokenCookie('__Secure-better-auth.session_token=xyz.sig'),
    ).toBe('xyz.sig')
  })

  it('does not match a lookalike cookie name', () => {
    expect(
      extractSessionTokenCookie('x-better-auth.session_token=nope'),
    ).toBeNull()
  })

  it('returns null when absent', () => {
    expect(extractSessionTokenCookie('foo=bar')).toBeNull()
  })

  // The deployed-admin cookie, set by /auth/handoff (the better-auth cookie
  // cannot cross from web's workers.dev origin). Same value shape.
  it('reads the baseout_admin_session handoff cookie', () => {
    expect(
      extractSessionTokenCookie('baseout_admin_session=tok.sig; other=1'),
    ).toBe('tok.sig')
  })

  it('prefers the better-auth cookie when both are present (local dev)', () => {
    expect(
      extractSessionTokenCookie(
        'baseout_admin_session=stale.sig; better-auth.session_token=fresh.sig',
      ),
    ).toBe('fresh.sig')
  })

  it('does not match a lookalike handoff cookie name', () => {
    expect(
      extractSessionTokenCookie('x-baseout_admin_session=nope'),
    ).toBeNull()
  })
})

describe('sessionTokenCandidates', () => {
  it('returns the token portion before the signature dot', () => {
    expect(sessionTokenCandidates('tok123.sigABC')).toContain('tok123')
  })

  it('includes the full decoded value as a fallback', () => {
    const c = sessionTokenCandidates('tok123.sigABC')
    expect(c).toContain('tok123.sigABC')
  })

  it('url-decodes the cookie value first', () => {
    // signature segment commonly arrives percent-encoded
    expect(sessionTokenCandidates('tok123.sig%2Babc')).toContain('tok123')
  })

  it('handles a value with no dot', () => {
    expect(sessionTokenCandidates('plaintoken')).toEqual(['plaintoken'])
  })
})

describe('decideAccess', () => {
  const now = new Date('2026-06-09T12:00:00Z')
  const future = new Date('2026-06-09T13:00:00Z')
  const past = new Date('2026-06-09T11:00:00Z')

  it('allows a super user with an unexpired session', () => {
    expect(decideAccess({ role: 'super', expiresAt: future }, now)).toEqual({
      ok: true,
    })
  })

  it('rejects a customer role', () => {
    expect(decideAccess({ role: 'customer', expiresAt: future }, now)).toEqual({
      ok: false,
      reason: 'not-super',
    })
  })

  it('rejects an expired session even for a super user', () => {
    expect(decideAccess({ role: 'super', expiresAt: past }, now)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('rejects when there is no session row', () => {
    expect(decideAccess(null, now)).toEqual({ ok: false, reason: 'no-session' })
  })
})
