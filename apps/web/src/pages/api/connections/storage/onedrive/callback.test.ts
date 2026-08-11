/**
 * Pins the post-OAuth redirect origin for the OneDrive callback (the
 * original 871f4d5 fix). Under `wrangler dev --remote` — or any stale
 * provider registration — the callback can land on a non-canonical host;
 * the browser redirect back must be ABSOLUTE on PUBLIC_AUTH_BASE_URL so the
 * user returns to the origin that actually holds their cookies.
 *
 * Drives the earliest failure branch (`?error=` from the provider, no
 * cookies) — real route code, no DB / token exchange / provider client.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv: Record<string, string | undefined> = {}
vi.mock('cloudflare:workers', () => ({ env: mockEnv }))

const { GET } = await import('./callback')

function call(requestUrl: string) {
  const url = new URL(requestUrl)
  return GET({
    locals: {},
    request: new Request(url.href),
    url,
  } as unknown as Parameters<typeof GET>[0])
}

const WRONG_HOST_CALLBACK =
  'https://baseout-dev.openside.workers.dev/api/connections/storage/onedrive/callback?error=access_denied'

describe('OneDrive callback — post-OAuth redirect origin', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockEnv)) delete mockEnv[k]
  })

  it('redirects to an absolute URL on PUBLIC_AUTH_BASE_URL when set', async () => {
    mockEnv.PUBLIC_AUTH_BASE_URL = 'https://baseout.local:4331'
    const res = await call(WRONG_HOST_CALLBACK)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe(
      'https://baseout.local:4331/backups?storage_error=access_denied',
    )
  })

  it('falls back to a relative redirect when PUBLIC_AUTH_BASE_URL is unset', async () => {
    const res = await call(WRONG_HOST_CALLBACK)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/backups?storage_error=access_denied')
  })
})
