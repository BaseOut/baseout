import { describe, expect, it, vi } from 'vitest'
import { createBackupEngine } from './backup-engine'

const TOKEN = 'test-internal-token'
const CONN_ID = '11111111-2222-3333-4444-555555555555'
// Placeholder base used by createBackupEngine when calling binding.fetch.
// Cloudflare ignores the host on a service binding — apps/server reads only
// path + headers + body — but Fetcher.fetch() requires an absolute URL.
const PLACEHOLDER_BASE = 'https://engine'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Build a Fetcher-shaped stub backed by the supplied handler. The handler
 * receives the full Request the engine client constructed (URL + headers +
 * method) and returns the Response the binding "would" return.
 *
 * vi.fn wraps the .fetch property so tests can assert call counts + inspect
 * the captured Request the same way they used to inspect (url, init).
 */
function fetcherStub(
  handler: (req: Request) => Promise<Response> | Response,
): Fetcher & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(new Request(input as RequestInfo, init)),
  )
  return { fetch } as unknown as Fetcher & {
    fetch: ReturnType<typeof vi.fn>
  }
}

describe('createBackupEngine.whoami', () => {
  it('calls binding.fetch with method POST and the canonical /api/internal/connections/:id/whoami path', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({
        connectionId: CONN_ID,
        airtable: { id: 'usrX', scopes: ['data.records:read'] },
      }),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    await engine.whoami(CONN_ID)
    expect(binding.fetch).toHaveBeenCalledOnce()
    const captured = binding.fetch.mock.calls[0]
    // First-arg form is checked via the Request the handler received; we
    // also assert here that the Fetcher.fetch was invoked with an absolute
    // URL placeholder + canonical path (the binding ignores the host).
    const url = new URL(captured![0] as string)
    expect(url.pathname).toBe(
      `/api/internal/connections/${CONN_ID}/whoami`,
    )
    expect(url.origin).toBe(PLACEHOLDER_BASE)
    const init = captured![1] as RequestInit
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['x-internal-token']).toBe(TOKEN)
    expect(headers.accept).toBe('application/json')
  })

  it('returns ok:true with connectionId + airtable on 200', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({
        connectionId: CONN_ID,
        airtable: {
          id: 'usrXYZ',
          scopes: ['data.records:read', 'schema.bases:read'],
          email: 'user@example.com',
        },
      }),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
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
    const binding = fetcherStub(() =>
      jsonResponse({ error: 'unauthorized' }, 401),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unauthorized')
      expect(result.status).toBe(401)
    }
  })

  it('maps 404 connection_not_found', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({ error: 'connection_not_found' }, 404),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('connection_not_found')
      expect(result.status).toBe(404)
    }
  })

  it('maps 409 connection_status and surfaces the connectionStatus field', async () => {
    const binding = fetcherStub(() =>
      jsonResponse(
        { error: 'connection_status', status: 'pending_reauth' },
        409,
      ),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('connection_status')
      expect(result.connectionStatus).toBe('pending_reauth')
    }
  })

  it('maps 502 airtable_token_rejected', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({ error: 'airtable_token_rejected' }, 502),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('airtable_token_rejected')
  })

  it('maps 502 airtable_upstream and surfaces upstreamStatus', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({ error: 'airtable_upstream', upstream_status: 503 }, 502),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('airtable_upstream')
      expect(result.upstreamStatus).toBe(503)
    }
  })

  it('maps unknown error codes to engine_error', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({ error: 'something_new' }, 418),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('engine_error')
      expect(result.status).toBe(418)
    }
  })

  it('maps fetch failure (engine unreachable) to engine_unreachable status:0', async () => {
    const binding = fetcherStub(() => {
      throw new TypeError('fetch failed')
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.whoami(CONN_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('engine_unreachable')
      expect(result.status).toBe(0)
    }
  })

  it('passes the connection_id through encodeURIComponent on the path', async () => {
    // Replaces the now-irrelevant "trailing slash on base URL" test. The
    // binding doesn't see a base URL the caller can trail-slash; the
    // remaining path-construction invariant worth covering is that the
    // connection id is URI-encoded so an injected slash or # can't escape
    // the canonical path.
    const binding = fetcherStub(() =>
      jsonResponse({
        connectionId: CONN_ID,
        airtable: { id: 'usrX', scopes: [] },
      }),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const dirty = '11111111-2222-3333-4444-555555555555/admin#x'
    await engine.whoami(dirty)
    const captured = binding.fetch.mock.calls[0]
    const url = new URL(captured![0] as string)
    expect(url.pathname).toBe(
      `/api/internal/connections/${encodeURIComponent(dirty)}/whoami`,
    )
  })
})
