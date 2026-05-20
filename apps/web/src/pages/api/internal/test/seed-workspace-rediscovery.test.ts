/**
 * Tests for the three-guard surface of `handleSeedWorkspaceRediscovery`.
 *
 * The seed endpoint's per-scenario invariants (baseline at_bases + included
 * rows + pending stubs land in the right shape) are covered end-to-end by
 * `apps/web/tests/e2e/workspace-rediscovery.spec.ts` against the deployed
 * dev worker — that path exercises the real Drizzle writes. These tests
 * cover the build / HMAC / input gates so we can't accidentally widen the
 * surface without seeing it.
 *
 * `cloudflare:workers` is mocked because the endpoint module pulls `env`
 * statically; we never call the Astro wrapper in this file — only the
 * exported `handleSeedWorkspaceRediscovery` helper.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleSeedWorkspaceRediscovery } = await import(
  './seed-workspace-rediscovery'
)

const SECRET = 'unit-test-secret'
const EMAIL = 'e2e-rescan-001@e2e.invalid'

function signEmail(secret: string, email: string): string {
  return createHmac('sha256', secret).update(email).digest('base64')
}

function makeUrl(
  email: string | null,
  scenario: string | null,
): URL {
  const url = new URL('https://example.test/api/internal/test/seed-workspace-rediscovery')
  if (email !== null) url.searchParams.set('email', email)
  if (scenario !== null) url.searchParams.set('scenario', scenario)
  return url
}

function makeHeaders(token: string | null): Headers {
  const h = new Headers()
  if (token !== null) h.set('x-e2e-test-auth', token)
  return h
}

describe('seed-workspace-rediscovery — guard 1 (build-time)', () => {
  it('returns 403 when E2E_TEST_MODE is not "true"', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'false', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(EMAIL, 'discover_only'),
      headers: makeHeaders(signEmail(SECRET, EMAIL)),
      db: null,
    })
    expect(res.status).toBe(403)
  })

  it('returns 403 when E2E_TEST_TOKEN is missing', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true' },
      url: makeUrl(EMAIL, 'discover_only'),
      headers: makeHeaders(signEmail(SECRET, EMAIL)),
      db: null,
    })
    expect(res.status).toBe(403)
  })
})

describe('seed-workspace-rediscovery — guard 3 (input shape)', () => {
  it('returns 400 when email is missing', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(null, 'discover_only'),
      headers: makeHeaders(signEmail(SECRET, EMAIL)),
      db: null,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when email does not match the e2e- pattern', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl('real-user@example.com', 'discover_only'),
      headers: makeHeaders(signEmail(SECRET, 'real-user@example.com')),
      db: null,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when scenario is missing', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(EMAIL, null),
      headers: makeHeaders(signEmail(SECRET, EMAIL)),
      db: null,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when scenario is not in the allow-list', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(EMAIL, 'do_anything_dangerous'),
      headers: makeHeaders(signEmail(SECRET, EMAIL)),
      db: null,
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; detail?: string }
    expect(body.detail).toBe('unknown_scenario')
  })
})

describe('seed-workspace-rediscovery — guard 2 (HMAC)', () => {
  it('returns 401 when the HMAC header is missing', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(EMAIL, 'auto_add'),
      headers: makeHeaders(null),
      db: null,
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when the HMAC signature does not match', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(EMAIL, 'auto_add'),
      headers: makeHeaders(signEmail('different-secret', EMAIL)),
      db: null,
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when the HMAC is signed against the wrong email', async () => {
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(EMAIL, 'auto_add'),
      headers: makeHeaders(signEmail(SECRET, 'e2e-other@e2e.invalid')),
      db: null,
    })
    expect(res.status).toBe(401)
  })

  it('returns 500 once all three guards pass but db is null', async () => {
    // Confirms guards admit a properly-signed e2e- email + valid scenario,
    // and that db absence surfaces a distinct 500 rather than a guard 4xx.
    const res = await handleSeedWorkspaceRediscovery({
      env: { E2E_TEST_MODE: 'true', E2E_TEST_TOKEN: SECRET },
      url: makeUrl(EMAIL, 'tier_cap'),
      headers: makeHeaders(signEmail(SECRET, EMAIL)),
      db: null,
    })
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('db_not_initialized')
  })
})
