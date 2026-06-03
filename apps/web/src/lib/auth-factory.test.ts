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
