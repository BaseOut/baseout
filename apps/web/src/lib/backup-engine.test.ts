import { describe, expect, it, vi } from 'vitest'
import { createBackupEngine } from './backup-engine'

const TOKEN = 'test-internal-token'
const CONN_ID = '11111111-2222-3333-4444-555555555555'
// The engine client uses a placeholder host on Fetcher.fetch — it's the
// `https://engine/...` path that ends up in the URL. Service bindings ignore
// the host; routing is by binding. Tests assert against this placeholder.
const EXPECTED_URL = `https://engine/api/internal/connections/${CONN_ID}/whoami`

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Build a stub Fetcher whose `fetch(...)` returns `response`. Mirrors the
 * minimal surface of Cloudflare's `Fetcher` interface — just enough for the
 * engine client to call.
 */
function stubFetcher(
  response: Response | (() => Promise<Response> | Response) | Error,
): { fetcher: Fetcher; fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async (..._args: Parameters<Fetcher['fetch']>) => {
    if (response instanceof Error) throw response
    return typeof response === 'function' ? await response() : response
  })
  return { fetcher: { fetch } as unknown as Fetcher, fetch }
}

describe('createBackupEngine.whoami', () => {
  it('sends POST with x-internal-token to the canonical path on the binding', async () => {
    const { fetcher, fetch } = stubFetcher(
      jsonResponse({
        connectionId: CONN_ID,
        airtable: { id: 'usrX', scopes: ['data.records:read'] },
      }),
    )
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    await engine.whoami(CONN_ID)
    expect(fetch).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetch.mock.calls[0]!
    expect(String(calledUrl)).toBe(EXPECTED_URL)
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['x-internal-token']).toBe(TOKEN)
    expect(headers.accept).toBe('application/json')
  })

  it('returns ok:true with connectionId + airtable on 200', async () => {
    const { fetcher } = stubFetcher(
      jsonResponse({
        connectionId: CONN_ID,
        airtable: {
          id: 'usrXYZ',
          scopes: ['data.records:read', 'schema.bases:read'],
          email: 'user@example.com',
        },
      }),
    )
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
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
    const { fetcher } = stubFetcher(jsonResponse({ error: 'unauthorized' }, 401))
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unauthorized')
      expect(result.status).toBe(401)
    }
  })

  it('maps 404 connection_not_found', async () => {
    const { fetcher } = stubFetcher(
      jsonResponse({ error: 'connection_not_found' }, 404),
    )
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('connection_not_found')
      expect(result.status).toBe(404)
    }
  })

  it('maps 409 connection_status and surfaces the connectionStatus field', async () => {
    const { fetcher } = stubFetcher(
      jsonResponse(
        { error: 'connection_status', status: 'pending_reauth' },
        409,
      ),
    )
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('connection_status')
      expect(result.connectionStatus).toBe('pending_reauth')
    }
  })

  it('maps 502 airtable_token_rejected', async () => {
    const { fetcher } = stubFetcher(
      jsonResponse({ error: 'airtable_token_rejected' }, 502),
    )
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('airtable_token_rejected')
  })

  it('maps 502 airtable_upstream and surfaces upstreamStatus', async () => {
    const { fetcher } = stubFetcher(
      jsonResponse({ error: 'airtable_upstream', upstream_status: 503 }, 502),
    )
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('airtable_upstream')
      expect(result.upstreamStatus).toBe(503)
    }
  })

  it('maps unknown error codes to engine_error', async () => {
    const { fetcher } = stubFetcher(
      jsonResponse({ error: 'something_new' }, 418),
    )
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('engine_error')
      expect(result.status).toBe(418)
    }
  })

  it('maps a thrown Fetcher error to engine_unreachable status:0', async () => {
    const { fetcher } = stubFetcher(new TypeError('binding not bound'))
    const engine = createBackupEngine({ fetcher, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('engine_unreachable')
      expect(result.status).toBe(0)
    }
  })
})
