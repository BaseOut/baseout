import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  encodeCursor,
  decodeCursor,
  compileFilters,
  MAX_FILTERS,
  type RecordFilter,
} from '../../../src/lib/per-space/record-read'

const dialect = new PgDialect()
const render = (q: SQL) => dialect.sqlToQuery(q)
// workerd has no Buffer — craft base64url tokens with btoa.
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('cursor codec', () => {
  it('round-trips a cursor through opaque base64url', () => {
    const c = { sortField: 'record_id', sortValue: 'recABC', recordId: 'recABC' }
    const token = encodeCursor(c)
    expect(token).not.toContain('{') // opaque, not raw JSON
    expect(token).not.toMatch(/[+/=]/) // url-safe
    expect(decodeCursor(token)).toEqual(c)
  })

  it('round-trips a null sort value and unicode', () => {
    const c = { sortField: 'fldName', sortValue: null, recordId: 'rec✓' }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  it('returns null on malformed / wrong-shape tokens', () => {
    expect(decodeCursor('')).toBeNull()
    expect(decodeCursor('not-base64!!')).toBeNull()
    expect(decodeCursor(b64url('{"x":1}'))).toBeNull() // valid base64, missing fields
    expect(decodeCursor(b64url('not json'))).toBeNull()
  })
})

describe('compileFilters', () => {
  const TABLE = 'tblX'
  const one = (f: RecordFilter) => {
    const { predicate, errors } = compileFilters(TABLE, [f])
    expect(errors).toEqual([])
    expect(predicate).not.toBeNull()
    return render(predicate!)
  }

  it('returns null predicate + no errors for an empty filter list', () => {
    expect(compileFilters(TABLE, [])).toEqual({ predicate: null, errors: [] })
  })

  it('parameterizes every value — nothing is string-concatenated', () => {
    const q = one({ fieldId: 'fldT', kind: 'text', op: 'contains', value: "o'brien %_" })
    expect(q.sql).not.toContain("o'brien")
    expect(q.params.length).toBeGreaterThan(0)
    expect(q.sql.toLowerCase()).toContain('exists')
    expect(q.sql).toContain('bo_at_record_field_data')
    expect(q.sql).toContain('bo_at_records.record_id') // correlated
  })

  it('text: contains uses ILIKE with escaped wildcards; equals compares JSON-encoded', () => {
    const contains = one({ fieldId: 'fldT', kind: 'text', op: 'contains', value: 'ac%me' })
    expect(contains.sql.toLowerCase()).toContain('ilike')
    expect(contains.params.some((p) => String(p).includes('\\%'))).toBe(true) // % escaped
    const equals = one({ fieldId: 'fldT', kind: 'text', op: 'equals', value: 'Acme' })
    expect(equals.params).toContain('"Acme"') // JSON-encoded string match
  })

  it('text: isEmpty / isNotEmpty use NOT EXISTS / EXISTS on a non-null value', () => {
    const empty = one({ fieldId: 'fldT', kind: 'text', op: 'isEmpty' })
    expect(empty.sql.toLowerCase()).toContain('not exists')
    expect(empty.sql).toContain('is not null')
    const notEmpty = one({ fieldId: 'fldT', kind: 'text', op: 'isNotEmpty' })
    expect(notEmpty.sql.toLowerCase()).toContain('exists')
    expect(notEmpty.sql.toLowerCase()).not.toContain('not exists')
  })

  it('number: comparisons cast to numeric behind a numeric guard, value bound as param', () => {
    const q = one({ fieldId: 'fldN', kind: 'number', op: 'gte', value: 42 })
    expect(q.sql).toContain('::numeric')
    expect(q.params).toContain(42)
    const between = one({ fieldId: 'fldN', kind: 'number', op: 'between', value: [1, 9] })
    expect(between.params).toContain(1)
    expect(between.params).toContain(9)
  })

  it('checkbox / select: JSON-encoded equality', () => {
    const check = one({ fieldId: 'fldC', kind: 'checkbox', op: 'is', value: true })
    expect(check.params).toContain('true')
    const sel = one({ fieldId: 'fldS', kind: 'select', op: 'is', value: 'Done' })
    expect(sel.params).toContain('"Done"')
  })

  it('multiSelect anyOf + linked containsRecordId use jsonb existence functions', () => {
    const any = one({ fieldId: 'fldM', kind: 'multiSelect', op: 'anyOf', value: ['a', 'b'] })
    expect(any.sql).toContain('jsonb_exists_any')
    const linked = one({ fieldId: 'fldL', kind: 'linked', op: 'containsRecordId', value: 'recZ' })
    expect(linked.sql).toContain('jsonb_exists')
    expect(linked.params).toContain('recZ')
  })

  it('ANDs multiple filters together', () => {
    const { predicate, errors } = compileFilters(TABLE, [
      { fieldId: 'fldT', kind: 'text', op: 'contains', value: 'x' },
      { fieldId: 'fldN', kind: 'number', op: 'lt', value: 5 },
    ])
    expect(errors).toEqual([])
    const q = render(predicate!)
    expect(q.sql.toLowerCase()).toContain(' and ')
    expect(q.params).toContain(5)
  })

  it('rejects an unknown operator for the field kind (error, filter dropped)', () => {
    const { predicate, errors } = compileFilters(TABLE, [
      { fieldId: 'fldC', kind: 'checkbox', op: 'contains', value: 'x' } as unknown as RecordFilter,
    ])
    expect(errors.length).toBe(1)
    expect(predicate).toBeNull()
  })

  it('caps the filter count', () => {
    const many: RecordFilter[] = Array.from({ length: MAX_FILTERS + 3 }, (_, i) => ({
      fieldId: `f${i}`,
      kind: 'text',
      op: 'isNotEmpty',
    }))
    const { errors } = compileFilters(TABLE, many)
    expect(errors.some((e) => /cap|too many|maximum/i.test(e))).toBe(true)
  })
})
