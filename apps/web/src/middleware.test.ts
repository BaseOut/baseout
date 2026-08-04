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
  sequence:
    (...fns: unknown[]) =>
    (...args: unknown[]) =>
      (fns[0] as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('cloudflare:workers', () => ({
  env: {
    AIRTABLE_STUBS_ENABLED: undefined,
    E2E_TEST_MODE: undefined,
  },
}))

import { buildLoginRedirect, isPublicRoute, resolveLoginBounceTarget } from './middleware'

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

// Pins the unauthenticated-page bounce target. Preserving the original
// destination as ?returnTo= means a transient session-cookie loss (e.g. a
// browser withholding the SameSite=Lax cookie on the cross-site return from
// an OAuth provider — the 2026-07-02 Box incident) costs the user one login
// instead of stranding them at the app root with no context.
describe('buildLoginRedirect', () => {
  it('carries the original path + query as returnTo', () => {
    expect(buildLoginRedirect('/destinations', '?connected=box')).toBe(
      '/login?returnTo=%2Fdestinations%3Fconnected%3Dbox',
    )
  })

  it('carries a bare path without a query', () => {
    expect(buildLoginRedirect('/backups', '')).toBe(
      '/login?returnTo=%2Fbackups',
    )
  })

  it('omits returnTo for the app root (the default post-login landing)', () => {
    expect(buildLoginRedirect('/', '')).toBe('/login')
  })

  it('omits returnTo for paths the sanitizer rejects', () => {
    expect(buildLoginRedirect('/api/foo', '')).toBe('/login')
  })
})

// Pins the signed-in /login bounce. A staffer bounced here from the DEPLOYED
// admin console arrives already holding a web session — redirecting them back
// to the raw admin origin would loop (the session cookie is host-only and
// cannot follow to a workers.dev sibling), and the old relative-only
// sanitizer stranded them at '/'. The allowlisted cross-origin target must
// resolve to the same-origin /api/admin/handoff wrapper instead.
// See openspec/changes/shared-admin-dev-deploy.
describe('resolveLoginBounceTarget', () => {
  const adminAppUrl = 'https://baseout-admin-dev.openside.workers.dev'

  it('wraps the allowlisted admin origin in the handoff route', () => {
    expect(
      resolveLoginBounceTarget(`${adminAppUrl}/`, { dev: false, adminAppUrl }),
    ).toBe('/api/admin/handoff')
  })

  it('keeps same-app relative paths', () => {
    expect(
      resolveLoginBounceTarget('/destinations?connected=box', { dev: false }),
    ).toBe('/destinations?connected=box')
  })

  it('redirects directly to a baseout.local origin in dev (shared cookie)', () => {
    expect(
      resolveLoginBounceTarget('http://baseout.local:4332/', { dev: true }),
    ).toBe('http://baseout.local:4332/')
  })

  it('falls back to the root for missing or unallowed targets', () => {
    expect(resolveLoginBounceTarget(null, { dev: false })).toBe('/')
    expect(
      resolveLoginBounceTarget('https://evil.example.com/', { dev: false, adminAppUrl }),
    ).toBe('/')
  })
})

describe('appendSetCookies — sliding-session cookie forwarding (2026-07-14)', () => {
  // The middleware's internal getSession is the ONLY place better-auth's
  // daily updateAge slide re-issues the session cookie for page loads.
  // Dropping these headers made every browser cookie hard-die `expiresIn`
  // after login regardless of activity — the recurring forced re-login of
  // Jun–Jul 2026. See oauth-setup.md §8.
  it('appends every forwarded set-cookie header', async () => {
    const { appendSetCookies } = await import('./middleware')
    const res = appendSetCookies(new Response('ok'), [
      'better-auth.session_token=tok.sig; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax',
      'better-auth.session_data=abc; Max-Age=300; Path=/; HttpOnly; SameSite=Lax',
    ])
    const cookies = res.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toContain('better-auth.session_token=')
    expect(cookies[1]).toContain('better-auth.session_data=')
  })

  it('returns the response unchanged when there is nothing to forward', async () => {
    const { appendSetCookies } = await import('./middleware')
    const res = new Response('ok')
    expect(appendSetCookies(res, [])).toBe(res)
    expect(res.headers.getSetCookie()).toHaveLength(0)
  })

  it('clones when the response headers are immutable', async () => {
    const { appendSetCookies } = await import('./middleware')
    const immutable = new Response('ok')
    Object.defineProperty(immutable, 'headers', {
      value: new Proxy(new Headers(), {
        get(target, prop) {
          if (prop === 'append') return () => { throw new TypeError('immutable') }
          const v = Reflect.get(target, prop)
          return typeof v === 'function' ? v.bind(target) : v
        },
      }),
    })
    const res = appendSetCookies(immutable, ['a=b; Path=/'])
    expect(res.headers.getSetCookie()).toEqual(['a=b; Path=/'])
  })
})

// HSTS is the deployed-TLS evidence for SOC 2 CC6.1/CC6.7 — Strict-Transport-
// Security on every deployed response, skipped on the local dev host
// (baseout.local's mkcert TLS is not a public HSTS context). Landed with the
// .github SOC 2 hardening set. See shared/internal/comp-ai-policies/
// secure-configuration-hardening.md and oauth-setup.md §5.5.
describe('embedFrameHeaders — HSTS (SOC 2 CC6.7 deployed-TLS evidence)', () => {
  const HSTS = 'max-age=63072000; includeSubDomains; preload'

  it('sets HSTS on a deployed host', async () => {
    const { embedFrameHeaders } = await import('./middleware')
    const context = { url: new URL('https://app.baseout.com/dashboard') } as never
    const res = (await embedFrameHeaders(context, async () => new Response('ok'))) as Response
    expect(res.headers.get('Strict-Transport-Security')).toBe(HSTS)
  })

  it('does NOT set HSTS on the local dev host (baseout.local)', async () => {
    const { embedFrameHeaders } = await import('./middleware')
    const context = { url: new URL('https://baseout.local:4331/dashboard') } as never
    const res = (await embedFrameHeaders(context, async () => new Response('ok'))) as Response
    expect(res.headers.get('Strict-Transport-Security')).toBeNull()
  })

  it('does not overwrite an existing HSTS header', async () => {
    const { embedFrameHeaders } = await import('./middleware')
    const context = { url: new URL('https://app.baseout.com/x') } as never
    const next = async () =>
      new Response('ok', { headers: { 'Strict-Transport-Security': 'max-age=1' } })
    const res = (await embedFrameHeaders(context, next)) as Response
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=1')
  })
})
