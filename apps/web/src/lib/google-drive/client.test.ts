import { describe, it, expect, vi } from 'vitest'
import { createGoogleDriveClient } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createGoogleDriveClient.about', () => {
  it('GETs /drive/v3/about with the bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({ user: { emailAddress: 'me@example.com' } }),
    )
    const client = createGoogleDriveClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const about = await client.about()
    expect(about.user.emailAddress).toBe('me@example.com')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/drive/v3/about')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer at_123')
  })

  it('throws GoogleDriveAuthError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 }))
    const client = createGoogleDriveClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.about()).rejects.toThrow(/access token/)
  })
})

describe('createGoogleDriveClient.ensureBaseoutFolder', () => {
  it('returns the existing folder when files.list hits', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ files: [{ id: 'folder_existing', name: 'Baseout-sp1' }] }),
      )
    const client = createGoogleDriveClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const folder = await client.ensureBaseoutFolder('Baseout-sp1')
    expect(folder.id).toBe('folder_existing')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/drive/v3/files?')
    expect(url).toContain('q=')
  })

  it('creates a new folder when files.list misses', async () => {
    const fetchImpl = vi
      .fn()
      // list: empty result
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      // create: returns new ID
      .mockResolvedValueOnce(
        jsonResponse({ id: 'folder_new', name: 'Baseout-sp1' }),
      )
    const client = createGoogleDriveClient({
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
    expect(createUrl).toContain('/drive/v3/files')
    expect(createInit.method).toBe('POST')
    const createBody = JSON.parse(createInit.body as string)
    expect(createBody.name).toBe('Baseout-sp1')
    expect(createBody.mimeType).toBe('application/vnd.google-apps.folder')
    expect(createBody.parents).toEqual(['root'])
  })

  it('rejects names containing illegal quote characters', async () => {
    const fetchImpl = vi.fn()
    const client = createGoogleDriveClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder("Bad'name")).rejects.toThrow(
      /illegal quote/,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws GoogleDriveAuthError on 401 from files.list', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 }))
    const client = createGoogleDriveClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('Baseout-sp1')).rejects.toThrow(
      /access token/,
    )
  })
})
