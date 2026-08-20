// Client methods for Automations / Interfaces manual CRUD
// (server-automations-interfaces-manual-crud).

import { describe, expect, it, vi } from 'vitest'
import { createBackupEngine } from './backup-engine'

const TOKEN = 'test-internal-token'
const SPACE = '11111111-2222-3333-4444-555555555555'

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

describe('createBackupEngine.getAutomations', () => {
  it('GETs automations with optional filters', async () => {
    const binding = fetcherStub((req) => {
      expect(req.method).toBe('GET')
      const u = new URL(req.url)
      expect(u.pathname).toBe(`/api/internal/spaces/${SPACE}/automations`)
      expect(u.searchParams.get('baseId')).toBe('appX')
      expect(u.searchParams.get('includeRemoved')).toBe('1')
      expect(req.headers.get('x-internal-token')).toBe(TOKEN)
      return jsonResponse({ ok: true, automations: [{ id: 'a1' }] })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getAutomations(SPACE, 'appX', true)
    expect(res).toEqual({ ok: true, automations: [{ id: 'a1' }] })
  })
})

describe('createBackupEngine.mutateAutomation', () => {
  it('POSTs mutate and returns the automation', async () => {
    const binding = fetcherStub(async (req) => {
      expect(req.method).toBe('POST')
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/automations/mutate`)
      const body = await req.json()
      expect(body).toEqual({ action: 'create', baseId: 'appX', name: 'N' })
      return jsonResponse({ ok: true, automation: { id: 'a1', name: 'N' } })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.mutateAutomation(SPACE, {
      action: 'create',
      baseId: 'appX',
      name: 'N',
    })
    expect(res).toEqual({ ok: true, automation: { id: 'a1', name: 'N' } })
  })

  it('maps duplicate_entity', async () => {
    const binding = fetcherStub(() => jsonResponse({ error: 'duplicate_entity' }, 409))
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.mutateAutomation(SPACE, {
      action: 'create',
      baseId: 'appX',
      airtableEntityId: 'aut1',
    })
    expect(res).toEqual({ ok: false, code: 'duplicate_entity', status: 409 })
  })
})

describe('createBackupEngine.getInterfaces / mutateInterface', () => {
  it('GETs interfaces', async () => {
    const binding = fetcherStub((req) => {
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/interfaces`)
      return jsonResponse({ ok: true, interfaces: [{ id: 'i1', type: 'interface' }] })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getInterfaces(SPACE)
    expect(res).toEqual({ ok: true, interfaces: [{ id: 'i1', type: 'interface' }] })
  })

  it('POSTs interface mutate', async () => {
    const binding = fetcherStub(async (req) => {
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/interfaces/mutate`)
      const body = await req.json()
      expect(body).toMatchObject({ action: 'create', type: 'page', parentId: 'pbd1' })
      return jsonResponse({ ok: true, interface: { id: 'p1', type: 'page' } })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.mutateInterface(SPACE, {
      action: 'create',
      baseId: 'appX',
      type: 'page',
      parentId: 'pbd1',
    })
    expect(res).toEqual({ ok: true, interface: { id: 'p1', type: 'page' } })
  })
})
