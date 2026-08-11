import { describe, expect, it } from 'vitest'
import { signInView, buildLoginUrl } from './auth-pages'

describe('signInView', () => {
  it('returns the generic copy with no params', () => {
    const view = signInView(null, null)
    expect(view.headline).toBe('Sign in')
    expect(view.detail).toContain('staff account')
    expect(view.errorNote).toBeNull()
  })

  it('maps the whitelisted reasons', () => {
    expect(signInView('expired', null).headline).toBe('Session expired')
    expect(signInView('signed-out', null).headline).toBe('Signed out')
    expect(signInView('no-session', null).headline).toBe('Sign in')
  })

  it('falls back to generic copy for unknown reasons (never echoes)', () => {
    const view = signInView('<script>alert(1)</script>', null)
    expect(view.headline).toBe('Sign in')
    expect(view.detail).not.toContain('script')
  })

  it('maps the whitelisted handoff errors to an error note', () => {
    expect(signInView(null, 'missing_token').errorNote).toContain('missing its token')
    expect(signInView(null, 'invalid_token').errorNote).toContain('60 seconds')
    expect(signInView(null, 'session_invalid').errorNote).toContain('did not validate')
    expect(signInView(null, 'misconfigured').errorNote).toContain('ADMIN_HANDOFF_SECRET')
  })

  it('ignores unknown error codes', () => {
    expect(signInView(null, 'evil').errorNote).toBeNull()
    expect(signInView(null, '').errorNote).toBeNull()
  })

  it('combines a reason and an error independently', () => {
    const view = signInView('expired', 'invalid_token')
    expect(view.headline).toBe('Session expired')
    expect(view.errorNote).toContain('60 seconds')
  })
})

describe('buildLoginUrl', () => {
  it('carries the admin origin as an encoded returnTo', () => {
    expect(buildLoginUrl('https://baseout.local:4331', 'http://baseout.local:4332')).toBe(
      'https://baseout.local:4331/login?returnTo=http%3A%2F%2Fbaseout.local%3A4332',
    )
  })
})
