import { describe, expect, it } from 'vitest'
import { shouldSetSecureOAuthCookie } from './local-dev-secure'

function req(url: string): Request {
  return new Request(url)
}

describe('shouldSetSecureOAuthCookie', () => {
  it.each([
    ['https://baseout.local:4331/api/connections/storage/dropbox/callback'],
    ['https://baseout.local:4331/api/connections/storage/onedrive/authorize'],
    ['https://baseout.local:4331/api/connections/airtable/start'],
  ])('returns false for baseout.local %s (cookies must drop Secure)', (url) => {
    expect(shouldSetSecureOAuthCookie(req(url))).toBe(false)
  })

  // Regression guard: `localhost` / `127.0.0.1` are no longer recognised as
  // local-dev hosts. Landing on those is a misconfiguration; Secure stays
  // on so the cookie drops loudly instead of silently working.
  it.each([
    ['https://localhost:4331/api/connections/storage/onedrive/authorize'],
    ['https://127.0.0.1:4331/api/connections/airtable/start'],
  ])('returns true for unsupported localhost host %s (Secure stays on; fail loud)', (url) => {
    expect(shouldSetSecureOAuthCookie(req(url))).toBe(true)
  })

  it.each([
    ['https://baseout.dev/api/connections/airtable/start'],
    ['https://baseout-dev.openside.workers.dev/api/connections/storage/box/authorize'],
    ['https://api.baseout.dev/api/connections/storage/onedrive/callback'],
  ])('returns true for deployed https host %s (Secure cookies in production)', (url) => {
    expect(shouldSetSecureOAuthCookie(req(url))).toBe(true)
  })

  it('returns false for non-https non-local hosts (no Secure flag without TLS)', () => {
    // Defensive: http:// on any host that isn't in the local-dev allow-list
    // shouldn't get Secure either. Production deploys are https://; this is
    // a guard against accidental misconfiguration.
    expect(shouldSetSecureOAuthCookie(req('http://example.com/api/connections/airtable/start'))).toBe(false)
  })

  it('fails closed to true when the URL is unparseable', () => {
    // Synthesise a Request with a URL we can't parse — fall back to Secure
    // on so the cookie is never accidentally weakened on a real deploy.
    const bogus = { url: 'not a url' } as unknown as Request
    expect(shouldSetSecureOAuthCookie(bogus)).toBe(true)
  })
})
