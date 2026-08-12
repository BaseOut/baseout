/**
 * Tests for the BYOK provider health-check (shared-ai-byok task 6.1).
 *
 * A cheap, per-provider validation call with `fetch` injected as a fake. The
 * load-bearing security assertions (design.md → Security review points): the
 * plaintext key travels ONLY in the request header, and the returned `error`
 * (a status-only reason) NEVER contains the key — nor does any console.* call.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkProviderKey } from './check-provider-key'

const KEY = 'sk-secret-DO-NOT-LEAK-abcd1234'

function okResponse(body: unknown = { data: [] }): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}
function statusResponse(status: number): Response {
  return new Response('{"error":"unauthorized"}', { status })
}

/** A fetch double that records its args and returns a preset response. */
function fakeFetch(response: Response) {
  return vi.fn(async (_url: string, _init?: RequestInit) => response)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkProviderKey — anthropic', () => {
  it('validates via the models-list endpoint with x-api-key + version header; ok on 2xx', async () => {
    const fetchImpl = fakeFetch(okResponse())
    const res = await checkProviderKey('anthropic', KEY, fetchImpl)

    expect(res.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/models')
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['x-api-key']).toBe(KEY)
    expect(headers['anthropic-version']).toBeTruthy()
    // the key rides in the header only — never in the URL
    expect(url).not.toContain(KEY)
  })

  it('returns {ok:false} with a status-only error on 401 — never the key', async () => {
    const fetchImpl = fakeFetch(statusResponse(401))
    const res = await checkProviderKey('anthropic', KEY, fetchImpl)

    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
    expect(res.error).not.toContain(KEY)
    expect(res.error).toContain('401')
  })

  it('is not ok on 403 either', async () => {
    const res = await checkProviderKey('anthropic', KEY, fakeFetch(statusResponse(403)))
    expect(res.ok).toBe(false)
  })
})

describe('checkProviderKey — openai', () => {
  it('validates via GET /v1/models with an Authorization: Bearer header; ok on 2xx', async () => {
    const fetchImpl = fakeFetch(okResponse())
    const res = await checkProviderKey('openai', KEY, fetchImpl)

    expect(res.ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/models')
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['Authorization']).toBe(`Bearer ${KEY}`)
    expect(url).not.toContain(KEY)
  })

  it('returns {ok:false} on 401 with no key in the error', async () => {
    const res = await checkProviderKey('openai', KEY, fakeFetch(statusResponse(401)))
    expect(res.ok).toBe(false)
    expect(res.error).not.toContain(KEY)
  })
})

describe('checkProviderKey — cloudflare', () => {
  it('is treated as ok without a validation call (no cheap endpoint)', async () => {
    const fetchImpl = fakeFetch(okResponse())
    const res = await checkProviderKey('cloudflare', KEY, fetchImpl)
    expect(res.ok).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('checkProviderKey — security', () => {
  it('never logs the key or writes it into the returned error (any status)', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'debug').mockImplementation(() => {}),
    ]

    for (const provider of ['anthropic', 'openai', 'cloudflare']) {
      const okRes = await checkProviderKey(provider, KEY, fakeFetch(okResponse()))
      const failRes = await checkProviderKey(provider, KEY, fakeFetch(statusResponse(401)))
      expect(JSON.stringify(okRes)).not.toContain(KEY)
      expect(JSON.stringify(failRes)).not.toContain(KEY)
    }

    for (const spy of spies) {
      const loggedTheKey = spy.mock.calls.some((args) => JSON.stringify(args).includes(KEY))
      expect(loggedTheKey).toBe(false)
      // the helper does no logging at all
      expect(spy).not.toHaveBeenCalled()
    }
  })

  it('fails closed (not ok) when the request throws, without leaking the key', async () => {
    const throwing = vi.fn(async () => {
      throw new Error(`boom ${KEY}`)
    })
    const res = await checkProviderKey('anthropic', KEY, throwing)
    expect(res.ok).toBe(false)
    expect(res.error).not.toContain(KEY)
  })
})
