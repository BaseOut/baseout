// DB-free coverage for the provenance / link-expansion I/O layer
// (server-data-browse Task 3.2b): the assembled SQL is rendered via PgDialect
// (no live PG) and asserted to be fully parameterized (never string-concatenated
// values), to reuse the pure record-provenance.ts predicates (linkedSetPredicate
// `= any(...)`, primaryFieldSearchPredicate ILIKE), and to page the id list with
// parseLinkIds/pageLinkIds. Live-PG behavior (real hydration + missing detection
// on seeded rows) is the deferred integration smoke (Task 5.1).

import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  buildFieldMetaSql,
  buildTablePrimaryFieldSql,
  buildCellValueSql,
  buildLinkedPageSql,
  buildFoundIdsSql,
  buildFieldValuesSql,
  buildPreviewFieldIdsSql,
  decodeCellValue,
  PREVIEW_FIELD_LIMIT,
} from '../../../src/lib/per-space/record-provenance-io'
import { parseLinkIds, pageLinkIds } from '../../../src/lib/per-space/record-provenance'

const render = (q: SQL) => new PgDialect().sqlToQuery(q)

describe('buildFieldMetaSql', () => {
  it('selects the options-bearing metadata columns, ids bound as params', () => {
    const { sql, params } = render(buildFieldMetaSql(['fldA', 'fldB']))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_fields')
    expect(lower).toContain('options')
    expect(lower).toContain('field_id in (')
    expect(sql).not.toContain('fldA') // never inlined
    expect(params).toContain('fldA')
    expect(params).toContain('fldB')
  })
})

describe('buildTablePrimaryFieldSql', () => {
  it('reads a single table row for its primary field, id bound', () => {
    const { sql, params } = render(buildTablePrimaryFieldSql('tblLinked'))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_tables')
    expect(lower).toContain('primary_field_id')
    expect(lower).toContain('limit')
    expect(params).toContain('tblLinked')
  })
})

describe('buildCellValueSql', () => {
  it('reads one cell by (record_id, field_id), both bound', () => {
    const { sql, params } = render(buildCellValueSql('recX', 'fldY'))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_record_field_data')
    expect(lower).toContain('record_id =')
    expect(lower).toContain('field_id =')
    expect(params).toEqual(expect.arrayContaining(['recX', 'fldY']))
  })
})

describe('buildLinkedPageSql', () => {
  it('bounds by the pure linkedSetPredicate (= any) and excludes deleted records', () => {
    const { sql, params } = render(buildLinkedPageSql('tblB', 'fldPrim', ['rec1', 'rec2'], null))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_records')
    expect(lower).toContain('any(') // linkedSetPredicate bound array
    expect(lower).toContain("status <> 'deleted'")
    expect(lower).toContain('left join bo_at_record_field_data rfd') // primary display join
    expect(params).toContain('tblB')
    expect(params).toContain('fldPrim')
  })

  it('adds the primary-field ILIKE search (escaped) when q is present', () => {
    const { sql, params } = render(buildLinkedPageSql('tblB', 'fldPrim', ['rec1'], 'ac%me'))
    expect(sql.toLowerCase()).toContain('ilike')
    expect(sql).not.toContain('ac%me') // needle never inlined
    expect(params.some((p) => String(p).includes('\\%'))).toBe(true) // wildcard escaped
  })

  it('omits the search clause when q is absent, and the primary join when no primary field', () => {
    const withNoQ = render(buildLinkedPageSql('tblB', 'fldPrim', ['rec1'], null))
    expect(withNoQ.sql.toLowerCase()).not.toContain('ilike')
    const noPrimary = render(buildLinkedPageSql('tblB', null, ['rec1'], 'term'))
    // no primary field → no join, no search possible, value select is null
    expect(noPrimary.sql.toLowerCase()).not.toContain('left join bo_at_record_field_data')
    expect(noPrimary.sql.toLowerCase()).not.toContain('ilike')
  })
})

describe('buildFoundIdsSql', () => {
  it('probes live-record existence over the page (= any, non-deleted), no search', () => {
    const { sql } = render(buildFoundIdsSql('tblB', ['rec1', 'rec2']))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_records')
    expect(lower).toContain('any(')
    expect(lower).toContain("status <> 'deleted'")
    expect(lower).not.toContain('ilike')
  })
})

describe('buildFieldValuesSql', () => {
  it('reads (record_id, field_id, value) for field + record sets, all bound', () => {
    const { sql, params } = render(buildFieldValuesSql('tblB', ['fld1', 'fld2'], ['rec1', 'rec2']))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_record_field_data')
    expect(lower).toContain('field_id in (')
    expect(lower).toContain('record_id in (')
    expect(params).toEqual(expect.arrayContaining(['tblB', 'fld1', 'fld2', 'rec1', 'rec2']))
    expect(sql).not.toContain('fld1')
  })
})

describe('buildPreviewFieldIdsSql', () => {
  it('takes a deterministic, bounded slice of active fields excluding the primary', () => {
    const { sql, params } = render(buildPreviewFieldIdsSql('tblB', 'fldPrim', PREVIEW_FIELD_LIMIT))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_fields')
    expect(lower).toContain("status = 'active'")
    expect(lower).toContain('field_id <>') // primary excluded
    expect(lower).toContain('order by field_id') // stable order
    expect(lower).toContain('limit')
    expect(params).toContain('tblB')
    expect(params).toContain('fldPrim')
    expect(params).toContain(PREVIEW_FIELD_LIMIT)
  })

  it('drops the exclusion clause when there is no primary field', () => {
    const { sql } = render(buildPreviewFieldIdsSql('tblB', null, 3))
    expect(sql.toLowerCase()).not.toContain('field_id <>')
  })
})

describe('decodeCellValue', () => {
  it('null → null; JSON string → native text; number/array preserved; raw fallback', () => {
    expect(decodeCellValue(null)).toBeNull()
    expect(decodeCellValue(JSON.stringify('Acme Corp'))).toBe('Acme Corp')
    expect(decodeCellValue(JSON.stringify(42))).toBe(42)
    expect(decodeCellValue(JSON.stringify(['rec1', 'rec2']))).toEqual(['rec1', 'rec2'])
    expect(decodeCellValue('not json')).toBe('not json')
  })
})

// The route pages the id list itself (never the hydrated set) via the pure
// helpers — a 10k-link cell yields one bounded page + a cursor id to resume.
describe('id-list paging (parseLinkIds → pageLinkIds)', () => {
  it('parses the JSON link cell then keyset-pages a large id list', () => {
    const ids = parseLinkIds(JSON.stringify(Array.from({ length: 10_000 }, (_, i) => `rec${i}`)))
    expect(ids).toHaveLength(10_000)

    const first = pageLinkIds(ids, null, 50)
    expect(first.pageIds).toHaveLength(50)
    expect(first.pageIds[0]).toBe('rec0')
    expect(first.nextCursor).toBe('rec49')

    const second = pageLinkIds(ids, first.nextCursor, 50)
    expect(second.pageIds[0]).toBe('rec50')

    // exhausting the list clears the cursor
    expect(pageLinkIds(ids, 'rec9998', 50).nextCursor).toBeNull()
  })

  it('an empty / malformed link cell yields no page and no cursor', () => {
    expect(pageLinkIds(parseLinkIds(null), null, 50)).toEqual({ pageIds: [], nextCursor: null })
    expect(pageLinkIds(parseLinkIds('broken'), null, 50)).toEqual({ pageIds: [], nextCursor: null })
  })
})
