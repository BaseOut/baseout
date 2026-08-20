// Client methods for Data browse + media (Slice A Task 2).
// Mirrors the Fetcher-stub pattern in backup-engine-documents.test.ts.

import { describe, expect, it, vi } from 'vitest'
import { createBackupEngine } from './backup-engine'

const TOKEN = 'test-internal-token'
const SPACE = '11111111-2222-3333-4444-555555555555'
const TABLE = 'tblDeals'
const ASSET = 'ast1'
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

describe('createBackupEngine.getDataRecords', () => {
  it('GETs data/tables/:tableId/records with token + query', async () => {
    const binding = fetcherStub((req) => {
      expect(req.method).toBe('GET')
      expect(req.headers.get('x-internal-token')).toBe(TOKEN)
      const url = new URL(req.url)
      expect(url.pathname).toBe(`/api/internal/spaces/${SPACE}/data/tables/${TABLE}/records`)
      expect(url.searchParams.get('limit')).toBe('50')
      return jsonResponse({
        ok: true,
        records: [{ recordId: 'rec1', createdTime: null, modifiedTime: null, status: 'active', fields: {} }],
        nextCursor: 'c1',
        total: 1,
        approximate: true,
        filterErrors: [],
      })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getDataRecords(SPACE, TABLE, { limit: 50 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.records).toHaveLength(1)
    expect(res.nextCursor).toBe('c1')
    expect(res.approximate).toBe(true)
  })

  it('maps 501 to backend_not_implemented', async () => {
    const binding = fetcherStub(() => jsonResponse({ error: 'backend_not_implemented' }, 501))
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getDataRecords(SPACE, TABLE)
    expect(res).toEqual({ ok: false, code: 'backend_not_implemented', status: 501 })
  })
})

describe('createBackupEngine.getDataChangelog', () => {
  it('returns rollup mode by default', async () => {
    const binding = fetcherStub((req) => {
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/data/changelog`)
      return jsonResponse({
        ok: true,
        mode: 'rollup',
        runs: [{ runId: 'run1', startedAt: null, completedAt: null, createdCount: 1, updatedCount: 0, deletedCount: 0 }],
        nextCursor: null,
      })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getDataChangelog(SPACE)
    expect(res.ok).toBe(true)
    if (!res.ok || res.mode !== 'rollup') throw new Error('expected rollup')
    expect(res.runs[0].runId).toBe('run1')
  })

  it('returns rows mode when the engine does', async () => {
    const binding = fetcherStub(() =>
      jsonResponse({
        ok: true,
        mode: 'rows',
        runId: 'run1',
        changeType: 'updated',
        rows: [
          {
            recordId: 'rec1',
            tableId: 'tbl1',
            baseId: 'appA',
            changeType: 'updated',
            createdTime: null,
            modifiedTime: null,
            status: 'active',
            changedFieldIds: ['a'],
          },
        ],
        nextCursor: null,
      }),
    )
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getDataChangelog(SPACE, { runId: 'run1', changeType: 'updated' })
    expect(res.ok).toBe(true)
    if (!res.ok || res.mode !== 'rows') throw new Error('expected rows')
    expect(res.rows).toHaveLength(1)
  })
})

describe('createBackupEngine.getMedia', () => {
  it('GETs /media with the token', async () => {
    const binding = fetcherStub((req) => {
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/media`)
      expect(req.headers.get('x-internal-token')).toBe(TOKEN)
      return jsonResponse({ ok: true, items: [], nextCursor: null })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getMedia(SPACE)
    expect(res).toEqual({ ok: true, items: [], nextCursor: null })
  })
})

describe('createBackupEngine.getMediaTotals', () => {
  it('GETs /media/totals', async () => {
    const binding = fetcherStub((req) => {
      expect(new URL(req.url).pathname).toBe(`/api/internal/spaces/${SPACE}/media/totals`)
      return jsonResponse({ ok: true, count: 3, sizeBytes: 99 })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.getMediaTotals(SPACE)
    expect(res).toEqual({ ok: true, count: 3, sizeBytes: 99 })
  })
})

describe('createBackupEngine.mediaDownload', () => {
  it('returns the raw Response with the token header', async () => {
    const binding = fetcherStub((req) => {
      expect(req.method).toBe('GET')
      expect(new URL(req.url).pathname).toBe(
        `/api/internal/spaces/${SPACE}/media/${ASSET}/download`,
      )
      expect(req.headers.get('x-internal-token')).toBe(TOKEN)
      return new Response('bytes', { status: 200 })
    })
    const engine = createBackupEngine({ binding, internalToken: TOKEN })
    const res = await engine.mediaDownload(SPACE, ASSET)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('bytes')
    expect(PLACEHOLDER_BASE).toBe('https://engine')
  })
})
