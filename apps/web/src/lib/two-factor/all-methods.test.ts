/**
 * Pure-helper tests for the all-methods 2FA challenge interception
 * (web-auth-2fa task 2.2, design Decision 1 — the challenge applies to
 * EVERY first factor; challenging selectively would leave a bypass).
 */

import { describe, expect, it } from 'vitest'
import {
  buildChallengeRedirect,
  INTERCEPTED_SIGN_IN_PATHS,
  sanitizeContinueTarget,
  signTrustDevicePayload,
} from './all-methods'

describe('INTERCEPTED_SIGN_IN_PATHS', () => {
  it('covers magic link AND generic OAuth (SSO) — no unchallenged method', () => {
    expect(INTERCEPTED_SIGN_IN_PATHS).toContain('/magic-link/verify')
    expect(INTERCEPTED_SIGN_IN_PATHS).toContain('/oauth2/callback/:providerId')
  })
})

describe('sanitizeContinueTarget', () => {
  const BASE = 'https://baseout.local:4331/api/auth'

  it('keeps relative in-app paths', () => {
    expect(sanitizeContinueTarget('/integrations', BASE)).toBe('/integrations')
    expect(sanitizeContinueTarget('/a?b=c', BASE)).toBe('/a?b=c')
  })

  it('reduces same-origin absolute URLs to their path', () => {
    expect(
      sanitizeContinueTarget('https://baseout.local:4331/settings?tab=x', BASE),
    ).toBe('/settings?tab=x')
  })

  it('rejects cross-origin and protocol-relative targets', () => {
    expect(sanitizeContinueTarget('https://evil.example/x', BASE)).toBeNull()
    expect(sanitizeContinueTarget('//evil.example/x', BASE)).toBeNull()
    expect(sanitizeContinueTarget('javascript:alert(1)', BASE)).toBeNull()
  })

  it('handles null/empty', () => {
    expect(sanitizeContinueTarget(null, BASE)).toBeNull()
    expect(sanitizeContinueTarget('', BASE)).toBeNull()
  })
})

describe('buildChallengeRedirect', () => {
  it('carries the sanitized continue target', () => {
    expect(buildChallengeRedirect('/integrations')).toBe(
      '/2fa?redirect=%2Fintegrations',
    )
    expect(buildChallengeRedirect(null)).toBe('/2fa')
  })
})

describe('signTrustDevicePayload', () => {
  it('is deterministic per (secret, payload) — HMAC-SHA256 base64url-nopad', async () => {
    const a = await signTrustDevicePayload('secret-1', 'user!device')
    const b = await signTrustDevicePayload('secret-1', 'user!device')
    const c = await signTrustDevicePayload('secret-2', 'user!device')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    // base64url, no padding
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.endsWith('=')).toBe(false)
  })

  it('matches a known HMAC-SHA256 vector', async () => {
    // HMAC-SHA256("key", "The quick brown fox jumps over the lazy dog")
    // = f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8
    const sig = await signTrustDevicePayload(
      'key',
      'The quick brown fox jumps over the lazy dog',
    )
    const expectHex = 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'
    const bytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (sig.length % 4)) % 4)), (ch) => ch.charCodeAt(0))
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(hex).toBe(expectHex)
  })
})
