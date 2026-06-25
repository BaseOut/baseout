// Client methods for the Schema Docs broker (openspec/changes/shared-schema-docs §3).
// Mirrors the Fetcher-stub pattern in backup-engine.test.ts.

import { describe, expect, it, vi } from 'vitest'
import { createBackupEngine } from './backup-engine'

const TOKEN = 'test-internal-token'
const SPACE = '11111111-2222-3333-4444-555555555555'
const DOC = '99999999-8888-7777-6666-555555555555'
const PLACEHOLDER_BASE = 'https://engine'

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

describe('createBackupEngine.listDocuments', () => {
  it('GETs /api/internal/spaces/:id/documents with the token and returns documents', async () => {
    const docs = [{ id: DOC, title: 'Conventions', excerpt: 'x', tagCount: 2 }]
    const binding = fetcherStub((req) => {
      expect(req.method).toBe('GET')
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/documents`)
      expect(req.headers.get('x-internal-token')).toBe(TOKEN)
      return jsonResponse({ ok: true, documents: docs })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.listDocuments(SPACE)
    expect(res).toEqual({ ok: true, documents: docs })
  })

  it('maps a 501 to backend_not_implemented', async () => {
    const binding = fetcherStub(() => jsonResponse({ error: 'backend_not_implemented' }, 501))
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.listDocuments(SPACE)
    expect(res).toEqual({ ok: false, code: 'backend_not_implemented', status: 501 })
  })

  it('returns engine_unreachable when the binding throws', async () => {
    const binding = fetcherStub(() => {
      throw new Error('down')
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.listDocuments(SPACE)
    expect(res).toEqual({ ok: false, code: 'engine_unreachable', status: 0 })
  })
})

describe('createBackupEngine.createDocument', () => {
  it('POSTs the document and returns it on 201', async () => {
    const created = { id: DOC, title: 'New', tags: [], links: [], diagrams: [] }
    const binding = fetcherStub(async (req) => {
      expect(req.method).toBe('POST')
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/documents`)
      expect(req.headers.get('content-type')).toBe('application/json')
      const body = (await req.json()) as { title: string }
      expect(body.title).toBe('New')
      return jsonResponse({ ok: true, document: created }, 201)
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.createDocument(SPACE, { title: 'New' })
    expect(res).toEqual({ ok: true, document: created })
  })
})

describe('createBackupEngine.getDocument', () => {
  it('GETs the item path and returns the document', async () => {
    const doc = { id: DOC, title: 'Doc', tags: [], links: [], diagrams: [] }
    const binding = fetcherStub((req) => {
      expect(req.method).toBe('GET')
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/documents/${DOC}`)
      return jsonResponse({ ok: true, document: doc })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getDocument(SPACE, DOC)
    expect(res).toEqual({ ok: true, document: doc })
  })

  it('maps a 404 to document_not_found', async () => {
    const binding = fetcherStub(() => jsonResponse({ error: 'document_not_found' }, 404))
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getDocument(SPACE, DOC)
    expect(res).toEqual({ ok: false, code: 'document_not_found', status: 404 })
  })
})

describe('createBackupEngine.updateDocument', () => {
  it('PATCHes the item path and returns the document', async () => {
    const doc = { id: DOC, title: 'Renamed', tags: [], links: [], diagrams: [] }
    const binding = fetcherStub(async (req) => {
      expect(req.method).toBe('PATCH')
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/documents/${DOC}`)
      const body = (await req.json()) as { title?: string }
      expect(body.title).toBe('Renamed')
      return jsonResponse({ ok: true, document: doc })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.updateDocument(SPACE, DOC, { title: 'Renamed' })
    expect(res).toEqual({ ok: true, document: doc })
  })
})

describe('createBackupEngine.deleteDocument', () => {
  it('DELETEs the item path and returns ok', async () => {
    const binding = fetcherStub((req) => {
      expect(req.method).toBe('DELETE')
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/documents/${DOC}`)
      return jsonResponse({ ok: true })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.deleteDocument(SPACE, DOC)
    expect(res).toEqual({ ok: true })
  })
})

describe('createBackupEngine.docsByEntity', () => {
  it('GETs docs-by-entity with the target query and returns the flagged result', async () => {
    const binding = fetcherStub((req) => {
      const url = new URL(req.url)
      expect(url.pathname).toBe(`/api/internal/spaces/${SPACE}/docs-by-entity`)
      expect(url.searchParams.get('targetType')).toBe('field')
      expect(url.searchParams.get('targetId')).toBe('fld1')
      return jsonResponse({ ok: true, entityRemoved: false, documents: [{ documentId: DOC, title: 'D' }] })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.docsByEntity(SPACE, 'field', 'fld1')
    expect(res).toEqual({
      ok: true,
      entityRemoved: false,
      documents: [{ documentId: DOC, title: 'D' }],
    })
    expect(new URL(PLACEHOLDER_BASE)).toBeTruthy()
  })
})
