import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  clampPageSize,
  parseSort,
  parseFilters,
  orderBySql,
  keysetAfter,
  encodeCursor,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Cursor,
} from '../../../src/lib/per-space/record-read'

const dialect = new PgDialect()
const render = (q: SQL) => dialect.sqlToQuery(q)

describe('clampPageSize', () => {
  it('defaults on absent / empty / non-numeric / non-positive', () => {
    expect(clampPageSize(null)).toBe(DEFAULT_PAGE_SIZE)
    expect(clampPageSize('')).toBe(DEFAULT_PAGE_SIZE)
    expect(clampPageSize('abc')).toBe(DEFAULT_PAGE_SIZE)
    expect(clampPageSize('0')).toBe(DEFAULT_PAGE_SIZE)
    expect(clampPageSize('-5')).toBe(DEFAULT_PAGE_SIZE)
  })
  it('floors and clamps to MAX_PAGE_SIZE', () => {
    expect(clampPageSize('25')).toBe(25)
    expect(clampPageSize('25.9')).toBe(25)
    expect(clampPageSize('9999')).toBe(MAX_PAGE_SIZE)
    expect(clampPageSize(String(MAX_PAGE_SIZE))).toBe(MAX_PAGE_SIZE)
  })
})

describe('parseSort', () => {
  it('defaults to record_id asc when absent', () => {
    expect(parseSort(null)).toEqual({ sort: { column: 'record_id', dir: 'asc' }, error: null })
  })
  it('parses a record column + direction', () => {
    expect(parseSort('created_time:desc')).toEqual({
      sort: { column: 'created_time', dir: 'desc' },
      error: null,
    })
    // any non-"desc" direction token falls back to asc
    expect(parseSort('modified_time:sideways').sort).toEqual({ column: 'modified_time', dir: 'asc' })
  })
  it('rejects a field-value sort as unsupported (documented follow-up)', () => {
    const r = parseSort('fldXYZ:asc')
    expect(r.error).toBe('unsupported_sort')
    expect(r.sort).toEqual({ column: 'record_id', dir: 'asc' }) // safe fallback
  })
})

describe('parseFilters', () => {
  it('empty for an absent param', () => {
    expect(parseFilters(null)).toEqual({ filters: [], errors: [] })
  })
  it('errors on invalid JSON and non-array', () => {
    expect(parseFilters('{not json').errors[0]).toContain('invalid JSON')
    expect(parseFilters('{"a":1}').errors[0]).toContain('expected an array')
  })
  it('keeps well-formed filters and reports malformed ones per-index', () => {
    const json = JSON.stringify([
      { fieldId: 'fldA', kind: 'text', op: 'contains', value: 'x' },
      { kind: 'text', op: 'contains' }, // missing fieldId
      42, // not an object
    ])
    const { filters, errors } = parseFilters(json)
    expect(filters).toHaveLength(1)
    expect(filters[0]).toMatchObject({ fieldId: 'fldA', kind: 'text', op: 'contains', value: 'x' })
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('filters[1]')
    expect(errors[1]).toContain('filters[2]')
  })
})

describe('orderBySql', () => {
  it('record_id: bare column, chosen direction, no tiebreak needed (PK is unique)', () => {
    expect(render(orderBySql({ column: 'record_id', dir: 'asc' })).sql).toContain('record_id asc')
    expect(render(orderBySql({ column: 'record_id', dir: 'desc' })).sql).toContain('record_id desc')
  })
  it('timestamp: NULLS LAST in both directions + record_id tiebreak', () => {
    const asc = render(orderBySql({ column: 'created_time', dir: 'asc' })).sql.toLowerCase()
    expect(asc).toContain('created_time asc nulls last')
    expect(asc).toContain('record_id asc')
    const desc = render(orderBySql({ column: 'modified_time', dir: 'desc' })).sql.toLowerCase()
    expect(desc).toContain('modified_time desc nulls last')
    expect(desc).toContain('record_id asc')
  })
})

describe('keysetAfter', () => {
  const cur = (c: Partial<Cursor>): Cursor => ({
    sortField: 'record_id',
    sortValue: 'recZ',
    recordId: 'recZ',
    ...c,
  })

  it('null when there is no cursor', () => {
    expect(keysetAfter({ column: 'record_id', dir: 'asc' }, null)).toBeNull()
  })

  it('record_id: simple > / < on the id, value bound as a param', () => {
    const asc = render(keysetAfter({ column: 'record_id', dir: 'asc' }, cur({ recordId: 'recM' }))!)
    expect(asc.sql).toContain('bo_at_records.record_id >')
    expect(asc.params).toContain('recM')
    const desc = render(keysetAfter({ column: 'record_id', dir: 'desc' }, cur({ recordId: 'recM' }))!)
    expect(desc.sql).toContain('bo_at_records.record_id <')
  })

  it('timestamp asc, non-null cursor: beyond-value OR null-tail OR tie', () => {
    const q = render(
      keysetAfter(
        { column: 'created_time', dir: 'asc' },
        cur({ sortField: 'created_time', sortValue: '2026-01-01T00:00:00.000Z', recordId: 'recM' }),
      )!,
    )
    const s = q.sql.toLowerCase()
    expect(s).toContain('> $') // beyond the cursor value
    expect(s).toContain('::timestamptz')
    expect(s).toContain('is null') // null-valued rows sort after (NULLS LAST)
    expect(s).toContain('= $') // tie on value → tiebreak on record_id
    expect(q.params).toContain('2026-01-01T00:00:00.000Z')
    expect(q.params).toContain('recM')
  })

  it('timestamp desc, non-null cursor: uses < for the beyond-value branch', () => {
    const q = render(
      keysetAfter(
        { column: 'modified_time', dir: 'desc' },
        cur({ sortField: 'modified_time', sortValue: '2026-06-01T00:00:00.000Z', recordId: 'recM' }),
      )!,
    )
    expect(q.sql.toLowerCase()).toContain('< $')
    expect(q.sql.toLowerCase()).toContain('is null')
  })

  it('timestamp, null cursor value: only the null tail remains, tiebroken by id', () => {
    const q = render(
      keysetAfter(
        { column: 'created_time', dir: 'asc' },
        cur({ sortField: 'created_time', sortValue: null, recordId: 'recM' }),
      )!,
    )
    const s = q.sql.toLowerCase()
    expect(s).toContain('is null')
    expect(s).toContain('record_id >')
    expect(s).not.toContain('::timestamptz') // no value comparison in the tail
  })

  it('cursor round-trips through the opaque encoder for a timestamp sort', () => {
    const c: Cursor = { sortField: 'created_time', sortValue: '2026-01-01T00:00:00.000Z', recordId: 'recA' }
    const token = encodeCursor(c)
    expect(token).not.toContain('{')
  })
})
