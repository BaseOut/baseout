// DB-free unit coverage for the record-export IO helpers (server-data-browse
// Task 3.5). Live-PG behavior (streaming a real scope, job round-trip) is the
// deferred integration smoke (Task 5.1). Here we cover the pure surface: the
// sync/async threshold decision, request/scope validation, the scope → SQL
// builders (rendered via PgDialect), and the CSV/JSON assembly over sample rows.

import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { sql, type SQL } from 'drizzle-orm'
import { compileFilters } from '../../../src/lib/per-space/record-read'
import {
  SYNC_THRESHOLD,
  decideExportMode,
  validateExportRequest,
  scopeWhereSql,
  cappedCountSql,
  tableFieldsSql,
  tableRecordsSql,
  recordFieldValuesSql,
  buildCsvLines,
  jsonTableRows,
  jsonExportChunks,
  type ExportFieldMeta,
  type ExportRecordRow,
} from '../../../src/lib/per-space/record-export-io'

const render = (q: SQL) => new PgDialect().sqlToQuery(q)

describe('decideExportMode (sync vs async threshold)', () => {
  it('sync at or below the threshold, async above it', () => {
    expect(decideExportMode(0)).toBe('sync')
    expect(decideExportMode(SYNC_THRESHOLD - 1)).toBe('sync')
    expect(decideExportMode(SYNC_THRESHOLD)).toBe('sync')
    expect(decideExportMode(SYNC_THRESHOLD + 1)).toBe('async')
  })

  it('honors an explicit threshold', () => {
    expect(decideExportMode(10, 10)).toBe('sync')
    expect(decideExportMode(11, 10)).toBe('async')
  })
})

describe('validateExportRequest', () => {
  it('accepts a single-table CSV scope', () => {
    const r = validateExportRequest({ format: 'csv', scope: { tableId: 'tblA' } })
    expect(r).toEqual({ ok: true, format: 'csv', scope: { baseId: undefined, tableId: 'tblA', sort: undefined }, filters: [] })
  })

  it('accepts a base-scoped JSON export', () => {
    const r = validateExportRequest({ format: 'json', scope: { baseId: 'appB', sort: 'created_time:desc' } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.scope).toEqual({ baseId: 'appB', tableId: undefined, sort: 'created_time:desc' })
  })

  it('rejects a bad format', () => {
    const r = validateExportRequest({ format: 'xml', scope: { tableId: 'tblA' } })
    expect(r).toMatchObject({ ok: false, param: 'format' })
  })

  it('rejects a missing scope', () => {
    expect(validateExportRequest({ format: 'csv' })).toMatchObject({ ok: false, param: 'scope' })
  })

  it('rejects an empty scope (no baseId or tableId)', () => {
    expect(validateExportRequest({ format: 'json', scope: {} })).toMatchObject({ ok: false, param: 'scope' })
  })

  it('rejects CSV without a single-table scope', () => {
    expect(validateExportRequest({ format: 'csv', scope: { baseId: 'appB' } })).toMatchObject({
      ok: false,
      param: 'scope',
    })
  })

  it('rejects a non-object body', () => {
    expect(validateExportRequest(null)).toMatchObject({ ok: false })
    expect(validateExportRequest('nope')).toMatchObject({ ok: false })
  })

  it('parses filters on a table scope and rejects filters without a table', () => {
    const ok = validateExportRequest({
      format: 'csv',
      scope: { tableId: 'tblA', filters: [{ fieldId: 'fldT', kind: 'text', op: 'contains', value: 'x' }] },
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.filters).toHaveLength(1)

    const bad = validateExportRequest({
      format: 'json',
      scope: { baseId: 'appB', filters: [{ fieldId: 'fldT', kind: 'text', op: 'contains', value: 'x' }] },
    })
    expect(bad).toMatchObject({ ok: false, param: 'scope' })
  })
})

describe('scope → SQL builders (parameterized, rendered)', () => {
  it('scopeWhereSql pins a single table when tableId is present', () => {
    const q = render(scopeWhereSql({ tableId: 'tblA', baseId: 'appB' }))
    expect(q.sql).toContain('bo_at_records.table_id')
    expect(q.sql).not.toContain('base_id')
    expect(q.params).toContain('tblA')
  })

  it('scopeWhereSql falls back to base scope when only baseId is present', () => {
    const q = render(scopeWhereSql({ baseId: 'appB' }))
    expect(q.sql).toContain('bo_at_records.base_id')
    expect(q.params).toContain('appB')
  })

  it('scopeWhereSql ANDs a compiled filter predicate (values stay parameterized)', () => {
    const { predicate } = compileFilters('tblA', [
      { fieldId: 'fldT', kind: 'text', op: 'contains', value: "o'brien" },
    ])
    const q = render(scopeWhereSql({ tableId: 'tblA' }, predicate))
    expect(q.sql.toLowerCase()).toContain('exists')
    expect(q.sql).not.toContain("o'brien") // the value is a bound param, never inlined
    expect(q.params.some((p) => String(p).includes("o'brien"))).toBe(true)
  })

  it('cappedCountSql counts at most cap + 1 rows', () => {
    const q = render(cappedCountSql(sql`bo_at_records.table_id = ${'tblA'}`, SYNC_THRESHOLD))
    expect(q.sql.toLowerCase()).toContain('count(*)')
    expect(q.sql.toLowerCase()).toContain('limit')
    expect(q.params).toContain(SYNC_THRESHOLD + 1)
  })

  it('tableFieldsSql orders primary-first and filters to active fields', () => {
    const q = render(tableFieldsSql('tblA'))
    expect(q.sql).toContain('bo_at_fields')
    expect(q.sql.toLowerCase()).toContain('is_primary desc')
    expect(q.sql).toContain("status = 'active'")
    expect(q.params).toContain('tblA')
  })

  it('tableRecordsSql applies an optional predicate + order-by', () => {
    const ob = sql`bo_at_records.record_id asc`
    const bare = render(tableRecordsSql('tblA', null, ob))
    expect(bare.sql).toContain('bo_at_records')
    expect(bare.sql.toLowerCase()).toContain('order by')

    const { predicate } = compileFilters('tblA', [{ fieldId: 'fldN', kind: 'number', op: 'gt', value: 5 }])
    const filtered = render(tableRecordsSql('tblA', predicate, ob))
    expect(filtered.sql.toLowerCase()).toContain('exists')
    expect(filtered.params).toContain(5)
  })

  it('recordFieldValuesSql binds every record id as a parameter', () => {
    const q = render(recordFieldValuesSql('tblA', ['rec1', 'rec2', 'rec3']))
    expect(q.sql).toContain('bo_at_record_field_data')
    expect(q.sql.toLowerCase()).toContain('record_id in')
    expect(q.params).toEqual(expect.arrayContaining(['tblA', 'rec1', 'rec2', 'rec3']))
  })
})

// ── Assembly over sample rows (uses the record-export.ts serializers) ─────────

const fields: ExportFieldMeta[] = [
  { fieldId: 'fldName', name: 'Name', type: 'singleLineText' },
  { fieldId: 'fldTags', name: 'Tags', type: 'multipleSelects' },
  { fieldId: 'fldFiles', name: 'Files', type: 'multipleAttachments' },
]

const records: ExportRecordRow[] = [
  {
    recordId: 'rec1',
    createdTime: null,
    modifiedTime: null,
    status: 'active',
    values: {
      fldName: '"Acme, Inc."', // JSON-encoded text with a comma → CSV must quote
      fldTags: '["a","b"]',
      fldFiles: '[{"id":"att1","filename":"a.pdf","url":"https://x/a.pdf"}]',
    },
  },
  {
    recordId: 'rec2',
    createdTime: null,
    modifiedTime: null,
    status: 'active',
    values: { fldName: '"Beta"' }, // missing Tags/Files → empty cells
  },
]

describe('buildCsvLines assembly', () => {
  it('streams a header then one line per record; attachments become references', () => {
    const out = [...buildCsvLines(fields, records)]
    expect(out[0]).toBe('record_id,Name,Tags,Files')
    expect(out[1]).toBe('rec1,"Acme, Inc.","a, b",a.pdf')
    expect(out[2]).toBe('rec2,Beta,,')
    expect(out).toHaveLength(3)
  })
})

describe('jsonTableRows assembly', () => {
  it('keys rows by field name with a record_id, attachments as references', () => {
    const rows = jsonTableRows(fields, records)
    expect(rows[0]).toEqual({ record_id: 'rec1', Name: 'Acme, Inc.', Tags: 'a, b', Files: 'a.pdf' })
    expect(rows[1]).toEqual({ record_id: 'rec2', Name: 'Beta', Tags: '', Files: '' })
  })
})

describe('jsonExportChunks streaming', () => {
  it('concatenated chunks parse back to the nested { bases → tables → rows } shape', () => {
    const shape = {
      bases: [
        {
          baseId: 'appB',
          baseName: 'Base',
          tables: [
            { tableId: 'tblA', tableName: 'A', rows: jsonTableRows(fields, records) },
            { tableId: 'tblEmpty', tableName: null, rows: [] },
          ],
        },
      ],
    }
    const joined = [...jsonExportChunks(shape)].join('')
    expect(JSON.parse(joined)).toEqual(shape)
  })
})
