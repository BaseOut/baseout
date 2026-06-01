// Regression test for the middleware route-gate. Pinned because re-gating
// the OAuth callback paths reintroduces the 401 "Not authenticated" 6-day
// debugging cycle from 2026-05-26 → 2026-06-01.
//
// The OAuth callbacks for Airtable (source platform) and the BYOS storage
// providers (Drive, Box, Dropbox, OneDrive) carry user identity through
// the OAuth round-trip via an encrypted handoff cookie — NOT via the
// better-auth session cookie. Browsers may not send the SameSite=Lax
// session cookie on the cross-site GET navigation back from the OAuth
// provider (Brave's shields are an example of stricter-than-spec
// cross-site cookie behavior), so middleware MUST treat these callback
// paths as public and let the callback handler do its own
// handoff-cookie-based identity check.
//
// Anything that flips one of these `expect(true)` assertions to false is
// reintroducing the bug. See shared/internal/oauth-setup.md §8 for the
// failure-mode entry, and 4d2ddfc for the fix.

import { describe, expect, it, vi } from 'vitest'

vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}))

vi.mock('cloudflare:workers', () => ({
  env: {
    AIRTABLE_STUBS_ENABLED: undefined,
    E2E_TEST_MODE: undefined,
  },
}))

import { isPublicRoute } from './middleware'

describe('isPublicRoute', () => {
  describe('OAuth callback paths — MUST be public (regression: 2026-06-01 4d2ddfc)', () => {
    it('Airtable source-platform callback is public', () => {
      expect(isPublicRoute('/api/connections/airtable/callback')).toBe(true)
    })

    it('Google Drive storage callback is public', () => {
      expect(isPublicRoute('/api/connections/storage/google-drive/callback')).toBe(true)
    })

    it('Box storage callback is public', () => {
      expect(isPublicRoute('/api/connections/storage/box/callback')).toBe(true)
    })

    it('Dropbox storage callback is public', () => {
      expect(isPublicRoute('/api/connections/storage/dropbox/callback')).toBe(true)
    })

    it('OneDrive storage callback is public', () => {
      expect(isPublicRoute('/api/connections/storage/onedrive/callback')).toBe(true)
    })
  })

  describe('OAuth non-callback paths — MUST remain session-gated', () => {
    it('Airtable /start requires a session', () => {
      expect(isPublicRoute('/api/connections/airtable/start')).toBe(false)
    })

    it('Airtable /disconnect requires a session', () => {
      expect(isPublicRoute('/api/connections/airtable/disconnect')).toBe(false)
    })

    it('Drive /authorize requires a session', () => {
      expect(isPublicRoute('/api/connections/storage/google-drive/authorize')).toBe(false)
    })

    it('Drive /disconnect requires a session', () => {
      expect(isPublicRoute('/api/connections/storage/google-drive/disconnect')).toBe(false)
    })

    it('Box /authorize requires a session', () => {
      expect(isPublicRoute('/api/connections/storage/box/authorize')).toBe(false)
    })
  })

  describe('Existing public paths still public', () => {
    it('/login is public', () => {
      expect(isPublicRoute('/login')).toBe(true)
    })

    it('/register is public', () => {
      expect(isPublicRoute('/register')).toBe(true)
    })

    it('/api/auth/* is public (better-auth handles its own auth)', () => {
      expect(isPublicRoute('/api/auth/sign-in/magic-link')).toBe(true)
      expect(isPublicRoute('/api/auth/callback/email')).toBe(true)
    })
  })

  describe('Regression guards — paths that LOOK like callbacks but are not', () => {
    it('a path with "callback" elsewhere is NOT public', () => {
      expect(isPublicRoute('/api/connections/callback/foo')).toBe(false)
    })

    it('a path with too many segments is NOT public', () => {
      expect(
        isPublicRoute('/api/connections/storage/google-drive/extra/callback'),
      ).toBe(false)
    })

    it('a path without /api/connections prefix is NOT public', () => {
      expect(isPublicRoute('/connections/airtable/callback')).toBe(false)
    })

    it('a callback path with a trailing segment is NOT public', () => {
      expect(isPublicRoute('/api/connections/airtable/callback/extra')).toBe(false)
    })
  })
})
