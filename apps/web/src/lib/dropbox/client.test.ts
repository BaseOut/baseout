import { describe, it, expect, vi } from 'vitest'
import { createDropboxClient } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createDropboxClient.getCurrentAccount', () => {
  it('POSTs /2/users/get_current_account with null body and bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc',
        email: 'me@example.com',
        name: { display_name: 'Me' },
      }),
    )
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const me = await client.getCurrentAccount()
    expect(me.email).toBe('me@example.com')
    expect(me.account_id).toMatch(/^dbid:/)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/users/get_current_account')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('null')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer at_123')
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('throws DropboxAuthError on 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.getCurrentAccount()).rejects.toThrow(/access token/)
  })

  it('throws DropboxApiError on non-2xx other than 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('oops', { status: 500 }))
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.getCurrentAccount()).rejects.toThrow(
      /users\/get_current_account 500/,
    )
  })
})

describe('createDropboxClient.ensureBaseoutFolder', () => {
  it('POSTs /2/files/create_folder_v2 with the path and autorename:false on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        metadata: {
          id: 'id:abc123',
          name: 'Baseout-sp1',
          path_display: '/Baseout-sp1',
          path_lower: '/baseout-sp1',
        },
      }),
    )
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const folder = await client.ensureBaseoutFolder('/Baseout-sp1')
    expect(folder.path).toBe('/Baseout-sp1')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/files/create_folder_v2')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.path).toBe('/Baseout-sp1')
    expect(body.autorename).toBe(false)
  })

  it("treats Dropbox's 409 path/conflict_folder response as idempotent success", async () => {
    // Re-Connect on a Space that already has /Baseout-<spaceId> MUST be a
    // no-op. Without this branch we'd surface as `persist_failed`.
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error_summary: 'path/conflict/folder/...',
          error: {
            '.tag': 'path',
            path: { '.tag': 'conflict', conflict: { '.tag': 'folder' } },
          },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const folder = await client.ensureBaseoutFolder('/Baseout-sp1')
    expect(folder.path).toBe('/Baseout-sp1')
  })

  it('rejects paths that do not start with /', async () => {
    const fetchImpl = vi.fn()
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('Baseout-sp1')).rejects.toThrow(
      /must start with/,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects paths with traversal segments', async () => {
    const fetchImpl = vi.fn()
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('/a/../b')).rejects.toThrow(
      /traversal/,
    )
    await expect(client.ensureBaseoutFolder('/a//b')).rejects.toThrow(
      /traversal/,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects paths ending with /', async () => {
    const fetchImpl = vi.fn()
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('/Baseout-sp1/')).rejects.toThrow(
      /cannot end with/,
    )
    await expect(client.ensureBaseoutFolder('/')).rejects.toThrow(
      /cannot end with/,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws DropboxAuthError on 401 from create_folder_v2', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('/Baseout-sp1')).rejects.toThrow(
      /access token/,
    )
  })

  it('throws DropboxApiError on non-2xx non-409 response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
    const client = createDropboxClient({
      accessToken: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.ensureBaseoutFolder('/Baseout-sp1')).rejects.toThrow(
      /create_folder_v2 500/,
    )
  })
})
