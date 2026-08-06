import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  valueSearchPredicate,
  fieldNameSearchPredicate,
  groupSearchHits,
  type SearchHit,
} from '../../../src/lib/per-space/record-search'
import {
  csvEscape,
  csvLine,
  formatCellForExport,
  csvLines,
} from '../../../src/lib/per-space/record-export'

const render = (q: SQL) => new PgDialect().sqlToQuery(q)
const hit = (over: Partial<SearchHit>): SearchHit => ({
  baseId: 'b1', baseName: 'Base 1', tableId: 't1', tableName: 'T1',
  recordId: 'rec1', fieldId: 'f1', snippet: null, ...over,
})

describe('record-search predicates', () => {
  it('value + field-name searches are parameterized ILIKEs with escaped wildcards', () => {
    const v = render(valueSearchPredicate('ac%me'))
    expect(v.sql.toLowerCase()).toContain('rfd.value ilike')
    expect(v.params.some((p) => String(p).includes('\\%'))).toBe(true)
    const f = render(fieldNameSearchPredicate('name_'))
    expect(f.sql.toLowerCase()).toContain('f.name ilike')
    expect(f.params.some((p) => String(p).includes('\\_'))).toBe(true)
  })
})

describe('groupSearchHits', () => {
  it('groups base → table, caps per table, flags hasMore and partial', () => {
    const hits = [
      hit({ recordId: 'r1' }),
      hit({ recordId: 'r2' }),
      hit({ recordId: 'r3' }), // 3rd hit in t1, over a cap of 2
      hit({ baseId: 'b2', baseName: 'Base 2', tableId: 't9', tableName: 'T9', recordId: 'r4' }),
    ]
    const res = groupSearchHits(hits, 2, { scanBudgetExceeded: true })
    expect(res.groups).toHaveLength(2)
    const b1 = res.groups.find((g) => g.baseId === 'b1')!
    expect(b1.tables[0].hits).toHaveLength(2)
    expect(b1.tables[0].hasMore).toBe(true)
    expect(res.partial).toBe(true)
  })

  it('no budget hit → partial false', () => {
    expect(groupSearchHits([hit({})], 20).partial).toBe(false)
  })
})

describe('record-export', () => {
  it('CSV-escapes commas, quotes, and newlines', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  it('csvLine renders nulls as empty and joins with commas', () => {
    expect(csvLine(['a', null, 'c,d'])).toBe('a,,"c,d"')
  })

  it('formats cells: JSON text unquoted, arrays joined, attachments as references', () => {
    expect(formatCellForExport('"hello"', 'singleLineText')).toBe('hello')
    expect(formatCellForExport('42', 'number')).toBe('42')
    expect(formatCellForExport('["a","b"]', 'multipleSelects')).toBe('a, b')
    expect(formatCellForExport(null, 'singleLineText')).toBe('')
    const att = formatCellForExport('[{"id":"att1","filename":"a.pdf","url":"https://x/a.pdf"}]', 'multipleAttachments')
    expect(att).toBe('a.pdf') // reference (filename), never bytes
  })

  it('csvLines streams the header then one line per row', () => {
    const out = [...csvLines(['id', 'name'], [['rec1', 'Acme'], ['rec2', 'B,Co']])]
    expect(out).toEqual(['id,name', 'rec1,Acme', 'rec2,"B,Co"'])
  })
})
