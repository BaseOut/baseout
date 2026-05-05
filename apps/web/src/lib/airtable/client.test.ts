import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAirtableClient } from './client'

describe('createAirtableClient', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  describe('whoami', () => {
    it('GETs /v0/meta/whoami with bearer token and returns the payload', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'usrFake',
            scopes: ['data.records:read', 'schema.bases:read'],
            email: 'user@example.com',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      const client = createAirtableClient({ accessToken: 'tok_123' })
      const me = await client.whoami()
      expect(me.id).toBe('usrFake')
      expect(me.email).toBe('user@example.com')
      expect(me.scopes).toEqual(['data.records:read', 'schema.bases:read'])

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.airtable.com/v0/meta/whoami')
      const headers = new Headers(init.headers)
      expect(headers.get('authorization')).toBe('Bearer tok_123')
    })

    it('throws AirtableAuthError on 401', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'INVALID_TOKEN' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const client = createAirtableClient({ accessToken: 'bad' })
      await expect(client.whoami()).rejects.toMatchObject({
        name: 'AirtableAuthError',
      })
    })
  })

  describe('listBases', () => {
    it('GETs /v0/meta/bases and returns the bases array', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            bases: [
              { id: 'appOne', name: 'Base One', permissionLevel: 'create' },
              { id: 'appTwo', name: 'Base Two', permissionLevel: 'edit' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      const client = createAirtableClient({ accessToken: 'tok' })
      const bases = await client.listBases()
      expect(bases).toHaveLength(2)
      expect(bases[0]).toEqual({
        id: 'appOne',
        name: 'Base One',
        permissionLevel: 'create',
      })
    })

    it('follows pagination via the offset cursor', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              bases: [{ id: 'appA', name: 'A', permissionLevel: 'create' }],
              offset: 'cursor1',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              bases: [{ id: 'appB', name: 'B', permissionLevel: 'edit' }],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
      const client = createAirtableClient({ accessToken: 'tok' })
      const bases = await client.listBases()
      expect(bases.map((b) => b.id)).toEqual(['appA', 'appB'])
      const secondCall = fetchMock.mock.calls[1] as [string, RequestInit]
      expect(secondCall[0]).toContain('offset=cursor1')
    })

    it('retries once on 429 then succeeds', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchMock
        .mockResolvedValueOnce(new Response('rate limit', { status: 429 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ bases: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      const client = createAirtableClient({ accessToken: 'tok' })
      const promise = client.listBases()
      const assertion = expect(promise).resolves.toEqual([])
      await vi.advanceTimersByTimeAsync(10_000)
      await assertion
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('gives up after the max number of retries on persistent 5xx', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValue(new Response('boom', { status: 503 }))
      const client = createAirtableClient({
        accessToken: 'tok',
        maxRetries: 2,
      })
      const promise = client.listBases()
      const assertion = expect(promise).rejects.toThrow()
      await vi.advanceTimersByTimeAsync(60_000)
      await assertion
      expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('does not retry on 401', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }))
      const client = createAirtableClient({ accessToken: 'tok' })
      const promise = client.listBases()
      const assertion = expect(promise).rejects.toMatchObject({
        name: 'AirtableAuthError',
      })
      await vi.advanceTimersByTimeAsync(60_000)
      await assertion
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
