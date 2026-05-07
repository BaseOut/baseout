import { describe, expect, it, vi } from 'vitest'
import { createBackupEngine } from './backup-engine'

const URL = 'http://engine.test'
const TOKEN = 'test-internal-token'
const CONN_ID = '11111111-2222-3333-4444-555555555555'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createBackupEngine.whoami', () => {
  it('sends POST with x-internal-token to the canonical path', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({
          connectionId: CONN_ID,
          airtable: { id: 'usrX', scopes: ['data.records:read'] },
        }),
      )
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    await engine.whoami(CONN_ID)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchImpl.mock.calls[0]!
    expect(String(calledUrl)).toBe(
      `${URL}/api/internal/connections/${CONN_ID}/whoami`,
    )
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['x-internal-token']).toBe(TOKEN)
    expect(headers.accept).toBe('application/json')
  })

  it('returns ok:true with connectionId + airtable on 200', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        connectionId: CONN_ID,
        airtable: {
          id: 'usrXYZ',
          scopes: ['data.records:read', 'schema.bases:read'],
          email: 'user@example.com',
        },
      }),
    )
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.connectionId).toBe(CONN_ID)
      expect(result.airtable.id).toBe('usrXYZ')
      expect(result.airtable.scopes).toEqual([
        'data.records:read',
        'schema.bases:read',
      ])
      expect(result.airtable.email).toBe('user@example.com')
    }
  })

  it('maps 401 unauthorized to code:unauthorized status:401', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401))
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unauthorized')
      expect(result.status).toBe(401)
    }
  })

  it('maps 404 connection_not_found', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ error: 'connection_not_found' }, 404),
      )
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('connection_not_found')
      expect(result.status).toBe(404)
    }
  })

  it('maps 409 connection_status and surfaces the connectionStatus field', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        { error: 'connection_status', status: 'pending_reauth' },
        409,
      ),
    )
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('connection_status')
      expect(result.connectionStatus).toBe('pending_reauth')
    }
  })

  it('maps 502 airtable_token_rejected', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ error: 'airtable_token_rejected' }, 502),
      )
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('airtable_token_rejected')
  })

  it('maps 502 airtable_upstream and surfaces upstreamStatus', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: 'airtable_upstream', upstream_status: 503 }, 502),
    )
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('airtable_upstream')
      expect(result.upstreamStatus).toBe(503)
    }
  })

  it('maps unknown error codes to engine_error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'something_new' }, 418))
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('engine_error')
      expect(result.status).toBe(418)
    }
  })

  it('maps fetch failure (engine unreachable) to engine_unreachable status:0', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('fetch failed'))
    const engine = createBackupEngine({
      url: URL,
      internalToken: TOKEN,
      fetchImpl,
    })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('engine_unreachable')
      expect(result.status).toBe(0)
    }
  })

  it('handles trailing slash on the base URL', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({
          connectionId: CONN_ID,
          airtable: { id: 'usrX', scopes: [] },
        }),
      )
    const engine = createBackupEngine({
      url: `${URL}/`,
      internalToken: TOKEN,
      fetchImpl,
    })
    await engine.whoami(CONN_ID)
    const [calledUrl] = fetchImpl.mock.calls[0]!
    expect(String(calledUrl)).toBe(
      `${URL}/api/internal/connections/${CONN_ID}/whoami`,
    )
  })
})
