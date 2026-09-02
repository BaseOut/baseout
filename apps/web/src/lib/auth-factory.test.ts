import { describe, it, expect } from 'vitest'
import { createAuth } from './auth-factory'

// Regression coverage for the local-dev session-cookie drop.
//
// The dev script serves at https://baseout.local:4331 with wrangler's
// localhost-only self-signed cert. better-auth defaults Secure: true +
// `__Secure-` prefix whenever baseURL is https://, and Chromium-family
// browsers drop Secure cookies under that hostname mismatch — so the
// session cookie never lands and login silently fails on refresh.
//
// createAuth derives advanced.useSecureCookies from the baseURL hostname:
// off for recognised local-dev hosts (drops Secure + the prefix), left
// undefined elsewhere so deployed/prod keeps better-auth's secure default.
function build(baseUrl: string | undefined) {
  return createAuth({} as never, {
    secret: 'test-secret',
    email: undefined,
    from: undefined,
    dev: false,
    baseUrl,
  })
}

function useSecureCookies(auth: ReturnType<typeof build>) {
  return (auth.options as { advanced: { useSecureCookies?: unknown } }).advanced
    .useSecureCookies
}

describe('createAuth — local-dev secure-cookie decision', () => {
  it('disables secure cookies for baseURL https://baseout.local:4331', () => {
    expect(useSecureCookies(build('https://baseout.local:4331'))).toBe(false)
  })

  // Regression guard: `localhost` / `127.0.0.1` used to be treated as
  // local-dev hosts. They no longer are — the canonical local URL is
  // baseout.local. Any session landing on those hostnames is a
  // misconfiguration and must NOT get the dev cookie behaviour.
  it.each([
    'http://localhost:4331',
    'https://localhost:4331',
    'http://127.0.0.1:4331',
  ])('does not disable secure cookies for unsupported localhost baseURL %s', (baseUrl) => {
    expect(useSecureCookies(build(baseUrl))).toBeUndefined()
  })

  it.each([
    'https://baseout.dev',
    'https://baseout-dev.openside.workers.dev',
    'https://baseout-staging.openside.workers.dev',
  ])('leaves secure cookies at better-auth default for deployed baseURL %s', (baseUrl) => {
    expect(useSecureCookies(build(baseUrl))).toBeUndefined()
  })

  it('leaves secure cookies at default when baseURL is unset (Host-header inference)', () => {
    expect(useSecureCookies(build(undefined))).toBeUndefined()
  })
})

// shared-embed-protocol Decision 9: SameSite=None; Secure so the session
// flows in embedded iframes on Chromium. Local dev (plain-cookie mode) must
// stay at the Lax default — None without Secure is dropped by browsers.
describe('createAuth — embedded-iframe cookie attributes', () => {
  function cookieAttributes(auth: ReturnType<typeof build>) {
    return (auth.options as { advanced: { defaultCookieAttributes?: unknown } })
      .advanced.defaultCookieAttributes
  }

  it.each([
    'https://baseout.dev',
    'https://baseout-dev.openside.workers.dev',
  ])('sets SameSite=None; Secure for deployed baseURL %s', (baseUrl) => {
    expect(cookieAttributes(build(baseUrl))).toEqual({
      sameSite: 'none',
      secure: true,
      partitioned: false,
    })
  })

  it('sets SameSite=None; Secure when baseURL is unset (deployed Host-header mode)', () => {
    expect(cookieAttributes(build(undefined))).toEqual({
      sameSite: 'none',
      secure: true,
      partitioned: false,
    })
  })

  it('keeps the Lax default in local-dev plain-cookie mode', () => {
    expect(cookieAttributes(build('https://baseout.local:4331'))).toBeUndefined()
  })
})

// web-auth-2fa: the twoFactor plugin (passwordless-compatible) plus the
// all-methods companion must both be registered, with the tighter 2FA
// rate-limit rules. Baseout stays passwordless — no credential plugin ever.
describe('createAuth — two-factor registration', () => {
  function pluginIds(auth: ReturnType<typeof build>) {
    return ((auth.options as { plugins?: Array<{ id: string }> }).plugins ?? []).map(
      (p) => p.id,
    )
  }

  it('registers twoFactor + the all-methods challenge companion', () => {
    const ids = pluginIds(build('https://baseout.dev'))
    expect(ids).toContain('two-factor')
    expect(ids).toContain('two-factor-all-methods')
  })

  it('exposes the stock challenge/manage endpoints', () => {
    const auth = build('https://baseout.dev')
    const api = auth.api as Record<string, unknown>
    for (const key of [
      'enableTwoFactor',
      'disableTwoFactor',
      'verifyTOTP',
      'verifyBackupCode',
    ]) {
      expect(typeof api[key], key).toBe('function')
    }
  })

  it('rate-limits the 2FA endpoints', () => {
    const rateLimit = (build('https://baseout.dev').options as {
      rateLimit?: { enabled?: boolean; customRules?: Record<string, unknown> }
    }).rateLimit
    expect(rateLimit?.enabled).toBe(true)
    expect(rateLimit?.customRules?.['/two-factor/verify-totp']).toEqual({
      window: 60,
      max: 5,
    })
  })

  it('never registers a password/credential surface (CLAUDE.md §3.3)', () => {
    const auth = build('https://baseout.dev')
    const options = auth.options as { emailAndPassword?: { enabled?: boolean } }
    expect(options.emailAndPassword?.enabled ?? false).toBe(false)
  })
})

describe('createAuth — session lifetime', () => {
  // 30-day sliding sessions (product decision 2026-07-09): better-auth's 7-day
  // default forced monthly-active users back through the magic-link flow. With
  // updateAge=1d, any visit a day after the last refresh pushes expiry out
  // another 30 days — active users stay signed in; an abandoned cookie still
  // dies within a month.
  it('sets a 30-day expiry with a 1-day sliding refresh', () => {
    const session = (build('https://baseout.dev').options as {
      session: { expiresIn?: number; updateAge?: number }
    }).session
    expect(session.expiresIn).toBe(60 * 60 * 24 * 30)
    expect(session.updateAge).toBe(60 * 60 * 24)
  })

})

// system-staging-readiness: console.baseout.dev worked only because
// better-auth auto-trusts the resolved baseURL origin — the moment
// PUBLIC_AUTH_BASE_URL is unset, baseURL falls back to https://baseout.dev
// and the CSRF gate rejects the staging origin. Pin both deployed console
// origins in the explicit lists so the fallback path can't strand them.
describe('createAuth — deployed console origins', () => {
  it('trusts the staging and production console origins explicitly', () => {
    const trusted = (build('https://baseout.dev').options as {
      trustedOrigins: string[]
    }).trustedOrigins
    expect(trusted).toContain('https://console.baseout.dev')
    expect(trusted).toContain('https://console.baseout.com')
  })

  it('accepts the console hosts in Host-header baseURL resolution', () => {
    const baseURL = (build(undefined).options as {
      baseURL: { allowedHosts: string[]; fallback: string }
    }).baseURL
    expect(baseURL.allowedHosts).toContain('console.baseout.dev')
    expect(baseURL.allowedHosts).toContain('console.baseout.com')
  })
})
