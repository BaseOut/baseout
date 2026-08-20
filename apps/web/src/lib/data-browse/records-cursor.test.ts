import { describe, it, expect, vi } from 'vitest'
import {
  fetchRecordsPage,
  ensureRecordsCover,
  mapRecordRows,
} from './records-cursor'
import type { DataRecordRow } from './engine-shapes'

function row(id: string, name: string): DataRecordRow {
  return {
    recordId: id,
    createdTime: null,
    modifiedTime: null,
    status: 'active',
    fields: { fldName: name },
  }
}

describe('mapRecordRows', () => {
  it('matches mapRecords (id/tableId/primary/cells)', () => {
    const [rec] = mapRecordRows([row('rec1', 'Acme')], 'tbl1', 'fldName')
    expect(rec).toMatchObject({
      id: 'rec1',
      tableId: 'tbl1',
      primary: 'Acme',
      cells: { fldName: { raw: 'Acme' } },
    })
  })
})

describe('fetchRecordsPage', () => {
  it('GETs the records proxy with tableId, limit, and optional cursor', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toBe(
        '/api/spaces/spc1/data/records?tableId=tbl1&limit=50&cursor=c1',
      )
      return new Response(
        JSON.stringify({
          ok: true,
          records: [row('rec2', 'Beta')],
          nextCursor: 'c2',
          total: 100,
          approximate: true,
          filterErrors: [],
        }),
        { status: 200 },
      )
    })

    const res = await fetchRecordsPage(
      { spaceId: 'spc1', tableId: 'tbl1', cursor: 'c1', limit: 50 },
      fetchFn,
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.records).toHaveLength(1)
    expect(res.nextCursor).toBe('c2')
    expect(res.total).toBe(100)
  })

  it('returns ok:false on HTTP error bodies', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }),
    )
    const res = await fetchRecordsPage(
      { spaceId: 'spc1', tableId: 'tbl1' },
      fetchFn,
    )
    expect(res).toEqual({ ok: false, status: 404, error: 'not_found' })
  })
})

describe('ensureRecordsCover', () => {
  it('no-ops when already loaded enough', async () => {
    const fetchPage = vi.fn()
    const res = await ensureRecordsCover({
      spaceId: 'spc1',
      tableId: 'tbl1',
      needCount: 50,
      loadedCount: 50,
      nextCursor: 'c1',
      fetchPage,
    })
    expect(res).toEqual({ ok: true, added: [], nextCursor: 'c1' })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('no-ops when cursor is exhausted (null)', async () => {
    const fetchPage = vi.fn()
    const res = await ensureRecordsCover({
      spaceId: 'spc1',
      tableId: 'tbl1',
      needCount: 100,
      loadedCount: 50,
      nextCursor: null,
      fetchPage,
    })
    expect(res).toEqual({ ok: true, added: [], nextCursor: null })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('fetches successive pages until needCount is covered', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        records: [row('rec51', 'A'), row('rec52', 'B')],
        nextCursor: 'c2',
        total: 4,
        approximate: false,
        filterErrors: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        records: [row('rec53', 'C'), row('rec54', 'D')],
        nextCursor: null,
        total: 4,
        approximate: false,
        filterErrors: [],
      })

    const res = await ensureRecordsCover({
      spaceId: 'spc1',
      tableId: 'tbl1',
      needCount: 54,
      loadedCount: 50,
      nextCursor: 'c1',
      primaryFieldId: 'fldName',
      pageLimit: 2,
      fetchPage,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.added.map((r) => r.id)).toEqual(['rec51', 'rec52', 'rec53', 'rec54'])
    expect(res.added[0].primary).toBe('A')
    expect(res.nextCursor).toBe(null)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: 'c1', limit: 2 }))
    expect(fetchPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'c2', limit: 2 }))
  })

  it('starts page-1 with no cursor when loadedCount is 0', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      ok: true,
      records: [row('rec1', 'A')],
      nextCursor: null,
      total: 1,
      approximate: false,
      filterErrors: [],
    })
    const res = await ensureRecordsCover({
      spaceId: 'spc1',
      tableId: 'tbl2',
      needCount: 25,
      loadedCount: 0,
      nextCursor: undefined,
      primaryFieldId: 'fldName',
      fetchPage,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.added).toHaveLength(1)
    expect(fetchPage).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 'tbl2', cursor: undefined }),
    )
  })

  it('propagates fetch errors', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      error: 'server_misconfigured',
    })
    const res = await ensureRecordsCover({
      spaceId: 'spc1',
      tableId: 'tbl1',
      needCount: 100,
      loadedCount: 0,
      nextCursor: undefined,
      fetchPage,
    })
    expect(res).toEqual({ ok: false, error: 'server_misconfigured' })
  })
})
