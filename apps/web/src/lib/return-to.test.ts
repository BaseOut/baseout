import { describe, it, expect } from 'vitest'
import { validateReturnTo } from './return-to'

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
