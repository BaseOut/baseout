import { describe, expect, it, vi } from 'vitest'
import { createDropboxClient } from './client'

const TOKEN = 'sl.dbx.test.access.token'
const SPACE_ID = '01HZX0000000000000000000A'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createDropboxClient.getCurrentAccount', () => {
  it('POSTs users/get_current_account with bearer auth and NO content-type header', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc',
        email: 'alice@example.com',
        name: { display_name: 'Alice Example' },
      }),
    )
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    const account = await client.getCurrentAccount()

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe(
      'https://api.dropboxapi.com/2/users/get_current_account',
    )
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`)
    // Dropbox quirk: this endpoint returns 400 if Content-Type is sent.
    // Regression guard.
    expect(headers['content-type']).toBeUndefined()

    expect(account).toEqual({
      accountId: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc',
      email: 'alice@example.com',
      displayName: 'Alice Example',
    })
  })

  it('throws when account_id or email is missing from the response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ account_id: 'dbid:abc' }), // no email
    )
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    await expect(client.getCurrentAccount()).rejects.toThrow(
      /missing account_id or email/,
    )
  })

  it('throws with the HTTP status on non-2xx', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'invalid' }, 401))
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    await expect(client.getCurrentAccount()).rejects.toThrow(/http_401/)
  })
})

describe('createDropboxClient.ensureBaseoutFolder', () => {
  it('POSTs files/create_folder_v2 with the literal /Apps/Baseout/<spaceId> path', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ metadata: { id: 'id:abc', path_lower: `/apps/baseout/${SPACE_ID.toLowerCase()}` } }),
    )
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    const result = await client.ensureBaseoutFolder(SPACE_ID)

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe(
      'https://api.dropboxapi.com/2/files/create_folder_v2',
    )
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`)
    expect(headers['content-type']).toBe('application/json')
    const body = JSON.parse(init?.body as string) as {
      path: string
      autorename: boolean
    }
    expect(body.path).toBe(`/Apps/Baseout/${SPACE_ID}`)
    expect(body.autorename).toBe(false)

    expect(result).toEqual({
      path: `/Apps/Baseout/${SPACE_ID}`,
      preExisting: false,
    })
  })

  it('swallows 409 path/conflict/folder (folder already exists) and returns preExisting: true', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error_summary: 'path/conflict/folder/...',
          error: { '.tag': 'path', path: { '.tag': 'folder' } },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    const result = await client.ensureBaseoutFolder(SPACE_ID)
    expect(result).toEqual({
      path: `/Apps/Baseout/${SPACE_ID}`,
      preExisting: true,
    })
  })

  it('swallows 409 path/conflict (top-level conflict tag) as a pre-existing folder', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error_summary: 'path/conflict/...',
          error: { '.tag': 'path', path: { '.tag': 'conflict' } },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    const result = await client.ensureBaseoutFolder(SPACE_ID)
    expect(result.preExisting).toBe(true)
  })

  it('does NOT swallow other 409 errors (e.g. path/conflict/file)', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error_summary: 'path/conflict/file/...',
          error: { '.tag': 'path', path: { '.tag': 'file' } },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    await expect(client.ensureBaseoutFolder(SPACE_ID)).rejects.toThrow(
      /create_folder_v2 conflict/,
    )
  })

  it('throws with the HTTP status on non-409 non-2xx', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'invalid' }, 500))
    const client = createDropboxClient({ accessToken: TOKEN, fetchImpl })
    await expect(client.ensureBaseoutFolder(SPACE_ID)).rejects.toThrow(
      /create_folder_v2 failed: http_500/,
    )
  })
})
