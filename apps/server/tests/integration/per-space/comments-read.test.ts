// Pure unit tests for the Data ▸ Comments read builders (server-comments-read).
// Mirrors record-read.test.ts: cursor codec round-trips, rendered-SQL assertions
// that prove every value is parameterized (never string-concatenated), filter
// parsing, and the raw-row → wire-row mapping. No live PG — SQL is rendered via
// PgDialect and the mapper is exercised on plain objects.

import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  encodeCommentsCursor,
  decodeCommentsCursor,
  parseCommentsFilters,
  buildCommentsWhere,
  commentsKeysetAfter,
  commentsOrderBy,
  mapCommentRow,
  commentCursorFor,
  type CommentDbRow,
} from '../../../src/lib/per-space/comments-read'

const dialect = new PgDialect()
const render = (q: SQL) => dialect.sqlToQuery(q)
// workerd has no Buffer — craft base64url tokens with btoa.
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('comments cursor codec', () => {
  it('round-trips a cursor through opaque base64url', () => {
    const c = { createdAt: '2026-08-01T10:00:00.000Z', commentId: 'comABC' }
    const token = encodeCommentsCursor(c)
    expect(token).not.toContain('{') // opaque, not raw JSON
    expect(token).not.toMatch(/[+/=]/) // url-safe
    expect(decodeCommentsCursor(token)).toEqual(c)
  })

  it('round-trips a null createdAt (the NULLS-LAST tail) and unicode', () => {
    const c = { createdAt: null, commentId: 'com✓' }
    expect(decodeCommentsCursor(encodeCommentsCursor(c))).toEqual(c)
  })

  it('returns null on malformed / wrong-shape tokens', () => {
    expect(decodeCommentsCursor('')).toBeNull()
    expect(decodeCommentsCursor('not-base64!!')).toBeNull()
    expect(decodeCommentsCursor(b64url('{"x":1}'))).toBeNull() // valid base64, missing fields
    expect(decodeCommentsCursor(b64url('not json'))).toBeNull()
    expect(decodeCommentsCursor(b64url('{"c":5,"i":"x"}'))).toBeNull() // createdAt wrong type
  })
})

describe('parseCommentsFilters', () => {
  const parse = (qs: string) => parseCommentsFilters(new URLSearchParams(qs))

  it('is empty + error-free with no params', () => {
    expect(parse('')).toEqual({ filters: {}, errors: [] })
  })

  it('reads baseId, tableId and a valid status', () => {
    expect(parse('baseId=app1&tableId=tbl1&status=deleted')).toEqual({
      filters: { baseId: 'app1', tableId: 'tbl1', status: 'deleted' },
      errors: [],
    })
  })

  it('drops an unknown status and reports it (query is never failed on it)', () => {
    const { filters, errors } = parse('status=weird')
    expect(filters.status).toBeUndefined()
    expect(errors).toHaveLength(1)
  })
})

describe('buildCommentsWhere', () => {
  it('is null when unfiltered', () => {
    expect(buildCommentsWhere({})).toBeNull()
  })

  it('parameterizes every filter value — nothing is string-concatenated', () => {
    const q = render(buildCommentsWhere({ baseId: 'app1', tableId: 'tbl1', status: 'active' })!)
    expect(q.sql).not.toContain('app1')
    expect(q.sql).not.toContain('tbl1')
    expect(q.params).toEqual(expect.arrayContaining(['app1', 'tbl1', 'active']))
    expect(q.sql.toLowerCase()).toContain(' and ')
    expect(q.sql).toContain('base_id')
    expect(q.sql).toContain('airtable_table_id')
    expect(q.sql).toContain('status')
  })
})

describe('commentsOrderBy', () => {
  it('is newest-first, NULLS LAST, with the unique-id tiebreak', () => {
    const sqlText = render(commentsOrderBy()).sql.toLowerCase()
    expect(sqlText).toContain('airtable_created_at desc nulls last')
    expect(sqlText).toContain('airtable_comment_id desc')
  })
})

describe('commentsKeysetAfter', () => {
  it('is null without a cursor', () => {
    expect(commentsKeysetAfter(null)).toBeNull()
  })

  it('non-null createdAt: casts the bound value to timestamptz and keeps NULLS LAST reachable', () => {
    const q = render(commentsKeysetAfter({ createdAt: '2026-08-01T10:00:00.000Z', commentId: 'comX' })!)
    expect(q.sql).toContain('::timestamptz')
    expect(q.sql.toLowerCase()).toContain('is null') // null tail stays reachable
    expect(q.params).toEqual(expect.arrayContaining(['2026-08-01T10:00:00.000Z', 'comX']))
    expect(q.sql).not.toContain('comX') // tiebreak value is a param
  })

  it('null createdAt: restricts to the null tail, tiebroken on the id', () => {
    const q = render(commentsKeysetAfter({ createdAt: null, commentId: 'comY' })!)
    expect(q.sql.toLowerCase()).toContain('airtable_created_at is null')
    expect(q.params).toContain('comY')
  })
})

describe('mapCommentRow', () => {
  const baseRow: CommentDbRow = {
    airtable_comment_id: 'com1',
    airtable_record_id: 'rec1',
    airtable_table_id: 'tbl1',
    base_id: 'app1',
    author: { id: 'usr1', name: 'Sam Silva', email: 's@example.com' },
    text: 'hello @[usr2]',
    airtable_created_at: new Date('2026-08-01T10:00:00.000Z'),
    airtable_last_updated_at: null,
    last_seen_at: new Date('2026-08-05T00:00:00.000Z'),
    status: 'active',
    raw: { id: 'com1', parentCommentId: 'com0', mentioned: { usr2: { id: 'usr2', displayName: 'Ana' } } },
  }

  it('maps identity + timestamps (Date → ISO) and carries author verbatim', () => {
    const w = mapCommentRow(baseRow)
    expect(w.commentId).toBe('com1')
    expect(w.recordId).toBe('rec1')
    expect(w.tableId).toBe('tbl1')
    expect(w.baseId).toBe('app1')
    expect(w.createdTime).toBe('2026-08-01T10:00:00.000Z')
    expect(w.lastUpdatedTime).toBeNull()
    expect(w.lastSeenAt).toBe('2026-08-05T00:00:00.000Z')
    expect(w.status).toBe('active')
    expect(w.author).toEqual({ id: 'usr1', name: 'Sam Silva', email: 's@example.com' })
  })

  it('extracts parentCommentId + mentioned from the verbatim raw payload', () => {
    const w = mapCommentRow(baseRow)
    expect(w.parentCommentId).toBe('com0')
    expect(w.mentioned).toEqual({ usr2: { id: 'usr2', displayName: 'Ana' } })
  })

  it('is defensive: malformed / absent raw yields null extras, never a throw', () => {
    const w = mapCommentRow({ ...baseRow, raw: 'not-an-object', author: null })
    expect(w.parentCommentId).toBeNull()
    expect(w.mentioned).toBeNull()
    expect(w.author).toBeNull()
  })

  it('commentCursorFor points at the row (createdTime + id)', () => {
    const w = mapCommentRow(baseRow)
    expect(commentCursorFor(w)).toEqual({ createdAt: '2026-08-01T10:00:00.000Z', commentId: 'com1' })
  })
})
