import { describe, it, expect } from 'vitest'
import {
  extractSessionTokenCookie,
  sessionTokenCandidates,
  decideAccess,
  isStaff,
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

describe('isStaff', () => {
  it('grants an explicit super role regardless of email', () => {
    expect(isStaff({ role: 'super', email: 'anyone@example.com' })).toBe(true)
  })

  it('grants a verified @openside.com email without a super role', () => {
    expect(isStaff({ role: 'customer', email: 'dan@openside.com' })).toBe(true)
  })

  it('is case-insensitive on the domain', () => {
    expect(isStaff({ role: 'customer', email: 'Dan@OpenSide.com' })).toBe(true)
  })

  // The `@` anchor is the security-critical part: a substring match would let
  // a lookalike domain through. These MUST stay denied.
  it('denies a lookalike or nested domain', () => {
    expect(isStaff({ role: 'customer', email: 'attacker@evil-openside.com' })).toBe(false)
    expect(isStaff({ role: 'customer', email: 'attacker@openside.com.evil.net' })).toBe(false)
    expect(isStaff({ role: 'customer', email: 'attacker@sub.openside.com' })).toBe(false)
  })

  it('denies an external domain', () => {
    expect(isStaff({ role: 'customer', email: 'user@gmail.com' })).toBe(false)
  })

  it('denies when email is null/absent and role is not super', () => {
    expect(isStaff({ role: 'customer', email: null })).toBe(false)
    expect(isStaff({ role: 'customer' })).toBe(false)
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

  it('allows a customer-role @openside.com user (staff by domain)', () => {
    expect(
      decideAccess(
        { role: 'customer', email: 'dan@openside.com', expiresAt: future },
        now,
      ),
    ).toEqual({ ok: true })
  })

  it('rejects a customer role with a non-staff email', () => {
    expect(
      decideAccess(
        { role: 'customer', email: 'x@gmail.com', expiresAt: future },
        now,
      ),
    ).toEqual({ ok: false, reason: 'not-staff' })
  })

  it('rejects a customer role with no email', () => {
    expect(decideAccess({ role: 'customer', expiresAt: future }, now)).toEqual({
      ok: false,
      reason: 'not-staff',
    })
  })

  it('rejects an expired session even for a staff user', () => {
    expect(
      decideAccess(
        { role: 'customer', email: 'dan@openside.com', expiresAt: past },
        now,
      ),
    ).toEqual({ ok: false, reason: 'expired' })
    expect(decideAccess({ role: 'super', expiresAt: past }, now)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('rejects when there is no session row', () => {
    expect(decideAccess(null, now)).toEqual({ ok: false, reason: 'no-session' })
  })
})
