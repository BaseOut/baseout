import { describe, it, expect } from 'vitest'
import { validateReturnTo, resolveLoginCallback } from './return-to'

describe('validateReturnTo', () => {
  it('accepts an http baseout.local URL in dev', () => {
    expect(
      validateReturnTo('http://baseout.local:4332/', { dev: true }),
    ).toBe('http://baseout.local:4332/')
  })

  it('accepts an https baseout.local URL in dev', () => {
    expect(
      validateReturnTo('https://baseout.local:4332/orgs', { dev: true }),
    ).toBe('https://baseout.local:4332/orgs')
  })

  it('rejects an off-domain URL (open-redirect guard)', () => {
    expect(validateReturnTo('https://evil.example.com/', { dev: true })).toBeNull()
  })

  it('rejects baseout.local in prod unless explicitly allowed', () => {
    expect(validateReturnTo('http://baseout.local:4332/', { dev: false })).toBeNull()
  })

  it('accepts an explicitly allowed prod origin', () => {
    expect(
      validateReturnTo('https://admin.baseout.com/', {
        dev: false,
        allowedOrigins: ['https://admin.baseout.com'],
      }),
    ).toBe('https://admin.baseout.com/')
  })

  it('rejects non-http(s) schemes', () => {
    expect(validateReturnTo('javascript:alert(1)', { dev: true })).toBeNull()
    expect(validateReturnTo('ftp://baseout.local/', { dev: true })).toBeNull()
  })

  it('returns null for empty / malformed input', () => {
    expect(validateReturnTo(null, { dev: true })).toBeNull()
    expect(validateReturnTo('', { dev: true })).toBeNull()
    expect(validateReturnTo('not a url', { dev: true })).toBeNull()
  })

  // Same-app relative paths — added for the middleware login bounce
  // (`/login?returnTo=<path>`), so a transient session-cookie loss (e.g. the
  // 2026-07-02 post-Box-OAuth bounce) returns the user where they were going
  // instead of stranding them at the app root.
  describe('same-app relative paths', () => {
    it('accepts a plain app path in any env', () => {
      expect(validateReturnTo('/destinations', { dev: true })).toBe('/destinations')
      expect(validateReturnTo('/destinations', { dev: false })).toBe('/destinations')
    })

    it('accepts a path with a query string', () => {
      expect(validateReturnTo('/destinations?connected=box', { dev: false })).toBe(
        '/destinations?connected=box',
      )
    })

    it('rejects protocol-relative and backslash-escape forms', () => {
      expect(validateReturnTo('//evil.example.com', { dev: true })).toBeNull()
      expect(validateReturnTo('/\\evil.example.com', { dev: true })).toBeNull()
    })

    it('rejects API paths', () => {
      expect(validateReturnTo('/api/auth/get-session', { dev: true })).toBeNull()
    })
  })
})

// The magic-link callbackURL / signed-in /login bounce resolver. Three shapes:
// relative paths pass through; baseout.local absolute URLs (shared-cookie dev
// host) redirect directly; any other allowlisted origin cannot receive web's
// session cookie (host-only + workers.dev is on the Public Suffix List), so it
// is wrapped in the same-origin /api/admin/handoff route, which mints the
// cross-origin handoff token. See openspec/changes/shared-admin-dev-deploy.
describe('resolveLoginCallback', () => {
  const adminOrigin = 'https://baseout-admin-dev.openside.workers.dev'
  const opts = { dev: false, allowedOrigins: [adminOrigin] }

  it('passes a relative path through unchanged', () => {
    expect(resolveLoginCallback('/destinations', opts)).toBe('/destinations')
  })

  it('returns a baseout.local URL directly in dev (shared-cookie host)', () => {
    expect(
      resolveLoginCallback('http://baseout.local:4332/', { dev: true }),
    ).toBe('http://baseout.local:4332/')
  })

  // Parameter-less on purpose: better-auth's verify endpoint double-decodes
  // the callbackURL, so an encoded ?to=<origin> resurfaces as "https://" and
  // fails its relative-path regex (INVALID_CALLBACK_URL). The route derives
  // the target from ADMIN_APP_URL instead.
  it('wraps an allowlisted cross-origin URL in the bare handoff route', () => {
    expect(resolveLoginCallback(`${adminOrigin}/`, opts)).toBe('/api/admin/handoff')
  })

  it('the wrapped callback survives better-auth relative-path validation even double-decoded', () => {
    const cb = resolveLoginCallback(`${adminOrigin}/`, opts)!
    // The exact regex from better-auth's matchesOriginPattern (allowRelativePaths).
    const betterAuthRelative = /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/
    expect(betterAuthRelative.test(cb)).toBe(true)
    expect(betterAuthRelative.test(decodeURIComponent(cb))).toBe(true)
  })

  it('rejects a non-allowlisted origin', () => {
    expect(resolveLoginCallback('https://evil.example.com/', opts)).toBeNull()
  })

  it('rejects baseout.local in prod (not allowlisted)', () => {
    expect(resolveLoginCallback('http://baseout.local:4332/', opts)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(resolveLoginCallback(null, opts)).toBeNull()
    expect(resolveLoginCallback('', opts)).toBeNull()
  })
})
