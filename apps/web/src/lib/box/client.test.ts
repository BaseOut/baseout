import { describe, it, expect, vi } from 'vitest'
import { createBoxClient } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createBoxClient.getCurrentUser', () => {
  it('GETs /users/me with the bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({ id: '12345', login: 'me@example.com', name: 'Me' }),
    )
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const me = await client.getCurrentUser()
    expect(me.id).toBe('12345')
    expect(me.login).toBe('me@example.com')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/users/me')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer at_123')
  })

  it('throws BoxAuthError on 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.getCurrentUser()).rejects.toThrow(/access token/)
  })

  it('throws BoxApiError on non-2xx other than 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('oops', { status: 500 }))
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.getCurrentUser()).rejects.toThrow(/users\/me 500/)
  })
})

describe('createBoxClient.ensureBaseoutFolder', () => {
  it('returns the existing folder when found in the root listing', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        entries: [
          { type: 'file', id: 'f-noise', name: 'Other.txt' },
          { type: 'folder', id: 'folder_existing', name: 'Baseout-sp1' },
          { type: 'folder', id: 'folder_noise', name: 'Other folder' },
        ],
      }),
    )
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const folder = await client.ensureBaseoutFolder('Baseout-sp1')
    expect(folder.id).toBe('folder_existing')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit]
    // Root listing must hit folder ID '0' specifically.
    expect(url).toContain('/folders/0/items')
    expect(url).toContain('fields=type%2Cid%2Cname')
  })

  it('does NOT match a file with the same name (filters on type=folder)', async () => {
    const fetchImpl = vi
      .fn()
      // List: a file with the target name, no folder.
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            { type: 'file', id: 'f1', name: 'Baseout-sp1' },
          ],
        }),
      )
      // Create: should be invoked because the folder doesn't exist yet.
      .mockResolvedValueOnce(
        jsonResponse({ id: 'folder_new', name: 'Baseout-sp1' }),
      )
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const folder = await client.ensureBaseoutFolder('Baseout-sp1')
    expect(folder.id).toBe('folder_new')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('creates a new folder under root when the listing misses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ entries: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'folder_new', name: 'Baseout-sp1' }),
      )
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const folder = await client.ensureBaseoutFolder('Baseout-sp1')
    expect(folder.id).toBe('folder_new')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [createUrl, createInit] = fetchImpl.mock.calls[1] as [
      string,
      RequestInit,
    ]
    expect(createUrl).toContain('/folders')
    expect(createInit.method).toBe('POST')
    const createBody = JSON.parse(createInit.body as string)
    expect(createBody.name).toBe('Baseout-sp1')
    expect(createBody.parent).toEqual({ id: '0' })
  })

  it('rejects names containing path separators', async () => {
    const fetchImpl = vi.fn()
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('Bad/name')).rejects.toThrow(
      /path separator/,
    )
    await expect(client.ensureBaseoutFolder('Bad\\name')).rejects.toThrow(
      /path separator/,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects empty or oversize names', async () => {
    const fetchImpl = vi.fn()
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('')).rejects.toThrow(/1..255/)
    await expect(client.ensureBaseoutFolder('x'.repeat(256))).rejects.toThrow(
      /1..255/,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws BoxAuthError on 401 from folders/0/items', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('Baseout-sp1')).rejects.toThrow(
      /access token/,
    )
  })

  it('throws BoxApiError if the create call fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ entries: [] }))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
    const client = createBoxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('Baseout-sp1')).rejects.toThrow(
      /POST \/folders 500/,
    )
  })
})
