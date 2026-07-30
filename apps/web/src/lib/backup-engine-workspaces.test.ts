/**
 * Engine-client contract tests for listConnectionWorkspaces
 * (web-workspace-bases; engine side is server-mcp-workspaces).
 *
 * Contract: GET /api/internal/connections/:connectionId/workspaces returns
 * `{ ok: true, workspaces: [{ id, name, permissionLevel? }], capturedAt }`
 * or `{ ok: false, degraded: true, reason }`. Web collapses EVERY failure
 * shape — transport throw, 404 while the engine half is unbuilt, non-2xx,
 * degraded payloads — to `{ ok: false, degraded: true }`.
 */

import { describe, expect, it, vi } from 'vitest'
import { createBackupEngine } from './backup-engine'

const TOKEN = 'test-internal-token'
const CONN_ID = '11111111-2222-3333-4444-555555555555'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function fetcherStub(
  handler: (req: Request) => Promise<Response> | Response,
): Fetcher & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(new Request(input as RequestInfo, init)),
  )
  return { fetch } as unknown as Fetcher & { fetch: ReturnType<typeof vi.fn> }
}

describe('createBackupEngine.listConnectionWorkspaces', () => {
  it('GETs the canonical internal path with the token and maps success', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({
        ok: true,
        workspaces: [
          { id: 'wspA', name: 'Ops', permissionLevel: 'owner' },
          { id: 'wspB', name: 'Marketing' },
        ],
        capturedAt: '2026-07-27T10:00:00.000Z',
      }),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.listConnectionWorkspaces(CONN_ID)

    const [url, init] = binding.fetch.mock.calls[0]!
    expect(new URL(url as string).pathname).toBe(
      `/api/internal/connections/${CONN_ID}/workspaces`,
    )
    expect((init as RequestInit).method).toBe('GET')
    expect(
      (init as { headers: Record<string, string> }).headers['x-internal-token'],
    ).toBe(TOKEN)

    expect(result).toEqual({
      ok: true,
      workspaces: [
        { id: 'wspA', name: 'Ops', permissionLevel: 'owner' },
        { id: 'wspB', name: 'Marketing' },
      ],
      capturedAt: '2026-07-27T10:00:00.000Z',
    })
  })

  it('drops malformed workspace entries and tolerates a missing capturedAt', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({ ok: true, workspaces: [{ id: 'wspA', name: 'Ops' }, { id: 42 }, 'junk'] }),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.listConnectionWorkspaces(CONN_ID)
    expect(result).toEqual({
      ok: true,
      workspaces: [{ id: 'wspA', name: 'Ops' }],
      capturedAt: null,
    })
  })

  it.each([
    ['engine 404 (server half unbuilt)', () => jsonResponse({ error: 'not_found' }, 404), 'not_found', 404],
    ['degraded payload with 200', () => jsonResponse({ ok: false, degraded: true, reason: 'mcp_scope_missing' }), 'mcp_scope_missing', 200],
    ['non-JSON 500', () => new Response('boom', { status: 500 }), 'engine_error', 500],
  ])('degrades on %s', async (_label, handler, reason, status) => {
    const engine = createBackupEngine({
      binding: fetcherStub(handler),
      internalToken: TOKEN,
    })
    const result = await engine.listConnectionWorkspaces(CONN_ID)
    expect(result).toEqual({ ok: false, degraded: true, reason, status })
  })

  it('degrades on transport failure (never throws)', async () => {
    const binding = {
      fetch: vi.fn().mockRejectedValue(new Error('binding down')),
    } as unknown as Fetcher
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const result = await engine.listConnectionWorkspaces(CONN_ID)
    expect(result).toEqual({
      ok: false,
      degraded: true,
      reason: 'engine_unreachable',
      status: 0,
    })
  })
})
