/**
 * Tests for the testable inner handler (handleGet) in auth-config.ts.
 * Mirrors the last-verification guard contract: E2E_TEST_MODE build gate,
 * E2E_TEST_TOKEN HMAC request gate, and 401/403 responses that reveal
 * nothing. The payload cases pin the session-cookie mode report used to
 * diagnose "post-OAuth bounce to /login" incidents (2026-07-02).
 *
 * `cloudflare:workers` is mocked because importing the route file pulls the
 * static `env` import; handleGet takes the env as an argument instead.
 */

import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { createHmac } from 'node:crypto'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleGet, AUTH_CONFIG_HMAC_PAYLOAD } = await import('./auth-config')

const SECRET = 'e2e-test-secret'

function mac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64')
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

const BASE_ENV = {
  E2E_TEST_MODE: 'true',
  E2E_TEST_TOKEN: SECRET,
  PUBLIC_AUTH_BASE_URL: 'https://baseout.local:4331',
}

describe('handleGet — guards', () => {
  it('returns 403 when E2E_TEST_MODE is not "true"', async () => {
    const res = handleGet(
      { ...BASE_ENV, E2E_TEST_MODE: undefined },
      mac(SECRET, AUTH_CONFIG_HMAC_PAYLOAD),
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when E2E_TEST_TOKEN is unset', async () => {
    const res = handleGet(
      { ...BASE_ENV, E2E_TEST_TOKEN: undefined },
      mac(SECRET, AUTH_CONFIG_HMAC_PAYLOAD),
    )
    expect(res.status).toBe(403)
  })

  it('returns 401 when the auth header is missing', async () => {
    const res = handleGet(BASE_ENV, null)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the HMAC does not match', async () => {
    const res = handleGet(BASE_ENV, mac('wrong-secret', AUTH_CONFIG_HMAC_PAYLOAD))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the HMAC is over the wrong payload', async () => {
    const res = handleGet(BASE_ENV, mac(SECRET, 'something-else'))
    expect(res.status).toBe(401)
  })
})

describe('handleGet — cookie-mode report', () => {
  it('reports plain-name non-secure cookies for baseout.local', async () => {
    const res = handleGet(BASE_ENV, mac(SECRET, AUTH_CONFIG_HMAC_PAYLOAD))
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({
      publicAuthBaseUrl: 'https://baseout.local:4331',
      secureCookies: 'off',
      sessionCookieName: 'better-auth.session_token',
    })
  })

  it('reports the secure default for deployed hosts', async () => {
    const res = handleGet(
      {
        ...BASE_ENV,
        PUBLIC_AUTH_BASE_URL: 'https://baseout-dev.openside.workers.dev',
      },
      mac(SECRET, AUTH_CONFIG_HMAC_PAYLOAD),
    )
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({
      publicAuthBaseUrl: 'https://baseout-dev.openside.workers.dev',
      secureCookies: 'secure-default',
      sessionCookieName: '__Secure-better-auth.session_token',
    })
  })

  it('reports the secure default when PUBLIC_AUTH_BASE_URL is unset', async () => {
    const res = handleGet(
      { ...BASE_ENV, PUBLIC_AUTH_BASE_URL: undefined },
      mac(SECRET, AUTH_CONFIG_HMAC_PAYLOAD),
    )
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({
      publicAuthBaseUrl: null,
      secureCookies: 'secure-default',
      sessionCookieName: '__Secure-better-auth.session_token',
    })
  })
})
