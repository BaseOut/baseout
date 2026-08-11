// DB-free coverage for the search I/O layer (server-data-browse Task 3.4):
// the assembled scan SQL is rendered via PgDialect (no live PG) and asserted to
// honor the record-search.ts alias contract (rfd/f), bind `q` as a param, apply
// the optional baseId/tableId filters, and cap at the scan budget. The snippet +
// scan-budget helpers are unit-tested directly. Live-PG behavior (real matches,
// grouping over real rows) is the deferred integration smoke (Task 5.1).

import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  buildSearchScanSql,
  buildSnippet,
  applyScanBudget,
  SEARCH_SCAN_BUDGET,
  SEARCH_PER_TABLE_CAP,
} from '../../../src/lib/per-space/record-search-io'

const render = (q: SQL) => new PgDialect().sqlToQuery(q)

describe('buildSearchScanSql', () => {
  it('joins rfd → f → t → b using the pure module aliases', () => {
    const { sql } = render(buildSearchScanSql({ q: 'acme' }))
    const lower = sql.toLowerCase()
    expect(lower).toContain('from bo_at_record_field_data rfd')
    expect(lower).toContain('join bo_at_fields f')
    expect(lower).toContain('join bo_at_tables t')
    expect(lower).toContain('join bo_at_bases')
    // both predicates use the aliases the pure module owns
    expect(lower).toContain('rfd.value ilike')
    expect(lower).toContain('f.name ilike')
    // value + field-name are OR'd into one candidate set
    expect(lower).toContain(' or ')
  })

  it('binds q as a param with escaped LIKE wildcards — never string-concatenated', () => {
    const { sql, params } = render(buildSearchScanSql({ q: 'ac%me_' }))
    expect(sql).not.toContain('ac%me') // raw needle never inlined
    // one bound param per predicate (value + field-name), both wildcard-escaped
    const escaped = params.filter((p) => /\\%|\\_/.test(String(p)))
    expect(escaped.length).toBe(2)
    expect(escaped.every((p) => String(p).includes('ac'))).toBe(true)
  })

  it('omits base/table filters when unscoped', () => {
    const { sql } = render(buildSearchScanSql({ q: 'x' }))
    const lower = sql.toLowerCase()
    // the `b.base_id`/`t.table_id` join predicates always appear; assert the
    // filter-specific `and …` clauses do NOT.
    expect(lower).not.toContain('and b.base_id =')
    expect(lower).not.toContain('and t.table_id =')
  })

  it('applies the optional baseId + tableId filters, bound as params', () => {
    const { sql, params } = render(
      buildSearchScanSql({ q: 'x', baseId: 'appBASE', tableId: 'tblTAB' }),
    )
    const lower = sql.toLowerCase()
    expect(lower).toContain('and b.base_id =')
    expect(lower).toContain('and t.table_id =')
    expect(params).toContain('appBASE')
    expect(params).toContain('tblTAB')
  })

  it('caps at the scan budget + 1 (overflow probe), bound as a param', () => {
    const { sql, params } = render(buildSearchScanSql({ q: 'x' }))
    expect(sql.toLowerCase()).toContain('limit')
    expect(params).toContain(SEARCH_SCAN_BUDGET + 1)
  })

  it('honors an explicit budget override', () => {
    const { params } = render(buildSearchScanSql({ q: 'x', budget: 10 }))
    expect(params).toContain(11)
  })
})

describe('buildSnippet', () => {
  it('null value → null snippet', () => {
    expect(buildSnippet(null)).toBeNull()
  })

  it('JSON-encoded string decodes to its native text', () => {
    expect(buildSnippet(JSON.stringify('hello world'))).toBe('hello world')
  })

  it('JSON null literal → null snippet', () => {
    expect(buildSnippet(JSON.stringify(null))).toBeNull()
  })

  it('non-string JSON (object/number) is re-serialized', () => {
    expect(buildSnippet(JSON.stringify({ x: 1 }))).toBe('{"x":1}')
    expect(buildSnippet(JSON.stringify(42))).toBe('42')
  })

  it('un-parseable value falls back to the raw text', () => {
    expect(buildSnippet('not json')).toBe('not json')
  })

  it('truncates long values with an ellipsis', () => {
    const long = JSON.stringify('a'.repeat(500))
    const snip = buildSnippet(long, 160)!
    expect(snip.length).toBe(161) // 160 chars + '…'
    expect(snip.endsWith('…')).toBe(true)
    expect(snip.startsWith('aaaa')).toBe(true)
  })
})

describe('applyScanBudget', () => {
  it('keeps all rows and flags no overflow at exactly the budget', () => {
    const rows = Array.from({ length: 5 }, (_, i) => i)
    const { hits, scanBudgetExceeded } = applyScanBudget(rows, 5)
    expect(hits).toHaveLength(5)
    expect(scanBudgetExceeded).toBe(false)
  })

  it('trims to the budget and flags overflow past it', () => {
    const rows = Array.from({ length: 6 }, (_, i) => i)
    const { hits, scanBudgetExceeded } = applyScanBudget(rows, 5)
    expect(hits).toHaveLength(5)
    expect(scanBudgetExceeded).toBe(true)
  })
})

describe('perf guardrail constants', () => {
  it('exposes the documented budget + per-table cap', () => {
    expect(SEARCH_SCAN_BUDGET).toBe(2000)
    expect(SEARCH_PER_TABLE_CAP).toBe(50)
  })
})
