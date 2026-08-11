import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  interpretProvenance,
  parseLinkIds,
  pageLinkIds,
  linkedSetPredicate,
  primaryFieldSearchPredicate,
  markMissing,
} from '../../../src/lib/per-space/record-provenance'

const render = (q: SQL) => new PgDialect().sqlToQuery(q)

describe('interpretProvenance', () => {
  it('formula: returns the expression + referenced field ids', () => {
    const p = interpretProvenance({
      type: 'formula',
      options: { formula: '{a}+{b}+{c}', referencedFieldIds: ['a', 'b', 'c'], isValid: true },
    })
    expect(p).toEqual({ kind: 'formula', expression: '{a}+{b}+{c}', referencedFieldIds: ['a', 'b', 'c'] })
  })

  it('formula: no referencedFieldIds → null refs + a reason (never parse the text)', () => {
    const p = interpretProvenance({ type: 'formula', options: { formula: '{a}+1' } })
    expect(p.kind).toBe('formula')
    if (p.kind === 'formula') {
      expect(p.referencedFieldIds).toBeNull()
      expect(p.reason).toBeTruthy()
    }
  })

  it('lookup: names the link field traversed + the looked-up field', () => {
    const p = interpretProvenance({
      type: 'multipleLookupValues',
      options: { recordLinkFieldId: 'lnk1', fieldIdInLinkedTable: 'fld9' },
    })
    expect(p).toMatchObject({ kind: 'lookup', recordLinkFieldId: 'lnk1', fieldIdInLinkedTable: 'fld9' })
  })

  it('rollup: adds the aggregation kind', () => {
    const p = interpretProvenance({
      type: 'rollup',
      options: { recordLinkFieldId: 'lnk1', fieldIdInLinkedTable: 'fld9', aggregation: 'SUM(values)' },
    })
    expect(p).toMatchObject({ kind: 'rollup', aggregation: 'SUM(values)' })
  })

  it('linked field → linked kind with the linked table id; plain field → none', () => {
    expect(interpretProvenance({ type: 'multipleRecordLinks', options: { linkedTableId: 'tblB' } })).toEqual({
      kind: 'linked',
      linkedTableId: 'tblB',
    })
    expect(interpretProvenance({ type: 'singleLineText', options: null })).toEqual({ kind: 'none' })
  })
})

describe('link-cell id list', () => {
  it('parses a JSON id array; tolerates null / non-array / non-string entries', () => {
    expect(parseLinkIds('["rec1","rec2"]')).toEqual(['rec1', 'rec2'])
    expect(parseLinkIds(null)).toEqual([])
    expect(parseLinkIds('"notarray"')).toEqual([])
    expect(parseLinkIds('[1,"rec2",null]')).toEqual(['rec2'])
    expect(parseLinkIds('broken')).toEqual([])
  })

  it('keyset-pages a 10k-id cell without hydrating the whole set', () => {
    const ids = Array.from({ length: 10_000 }, (_, i) => `rec${i}`)
    const first = pageLinkIds(ids, null, 50)
    expect(first.pageIds).toHaveLength(50)
    expect(first.pageIds[0]).toBe('rec0')
    expect(first.nextCursor).toBe('rec49')
    const second = pageLinkIds(ids, first.nextCursor, 50)
    expect(second.pageIds[0]).toBe('rec50')
    // last page has no next cursor
    expect(pageLinkIds(ids, 'rec9998', 50).nextCursor).toBeNull()
  })

  it('bounding predicate + primary-field search are parameterized', () => {
    const bound = render(linkedSetPredicate(['rec1', 'rec2']))
    expect(bound.sql).toContain('any(')
    expect(bound.params.length).toBeGreaterThan(0)
    const search = render(primaryFieldSearchPredicate('tblB', 'fldPrimary', 'ac%me'))
    expect(search.sql.toLowerCase()).toContain('ilike')
    expect(search.sql).toContain('bo_at_records.record_id')
    expect(search.params.some((p) => String(p).includes('\\%'))).toBe(true) // escaped
  })

  it('marks dangling ids (linked record deleted since backup) as missing', () => {
    expect(markMissing(['rec1', 'rec2', 'rec3'], new Set(['rec1', 'rec3']))).toEqual([
      { recordId: 'rec2', missing: true },
    ])
  })
})
