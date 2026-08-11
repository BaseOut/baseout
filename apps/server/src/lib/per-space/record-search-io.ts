// I/O layer for the cross-base/table search route (server-data-browse Task 3.4).
// Wraps the pure predicates + grouping in record-search.ts (which owns the
// parameterized ILIKEs and the base→table grouping); this module assembles the
// scan SQL, executes it against the per-Space Postgres, decodes each matched
// cell into a snippet, and enforces the Space-level scan budget.
//
// The pg_trgm GIN index on record_field_data.value is DEFERRED (tasks 2.1),
// so the value ILIKE runs as a bounded sequential scan. The scan budget is the
// circuit breaker the design (§Search) specifies as the fallback: cap candidate
// rows, and if the cap is hit set `partial: true` so the UI states "showing
// first matches". `bo_at_record_field_data.value` is JSON-encoded text — decoded
// back to native before the snippet is truncated.

import { sql, type SQL } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'
import {
  valueSearchPredicate,
  fieldNameSearchPredicate,
  groupSearchHits,
  type SearchHit,
  type SearchResult,
} from './record-search'

// Max candidate rows collected before the scan is cut off (design §Perf
// guardrails: "search scan budget"). One extra row is fetched so an exact-budget
// result is distinguishable from an overflow.
export const SEARCH_SCAN_BUDGET = 2000
// Rows kept per (base, table) group; extra hits set the group's `hasMore`.
export const SEARCH_PER_TABLE_CAP = 50
// Snippet excerpt length before truncation.
const SNIPPET_MAX_LEN = 160

export interface SearchScanArgs {
  q: string
  baseId?: string | null
  tableId?: string | null
  /** Row cap; the query fetches `budget + 1` to detect overflow. */
  budget?: number
}

/**
 * The cross-base/table scan: bo_at_record_field_data (rfd) ⋈ bo_at_fields (f) ⋈
 * bo_at_tables (t) ⋈ bo_at_bases (b), keeping a row when EITHER the cell value
 * ILIKE-matches (rfd.value) OR the field name ILIKE-matches (f.name) — the two
 * predicates the pure module owns (aliases rfd/f are its contract). One flat row
 * per matched cell, `limit budget + 1` so the caller can flag the scan-budget
 * overflow. Optional baseId/tableId narrow the scan. `q` binds as a param.
 */
export function buildSearchScanSql(args: SearchScanArgs): SQL {
  const budget = args.budget ?? SEARCH_SCAN_BUDGET
  const baseFilter = args.baseId ? sql`and b.base_id = ${args.baseId}` : sql``
  const tableFilter = args.tableId ? sql`and t.table_id = ${args.tableId}` : sql``
  return sql`
    select
      b.base_id     as base_id,
      b.name        as base_name,
      t.table_id    as table_id,
      t.name        as table_name,
      rfd.record_id as record_id,
      rfd.field_id  as field_id,
      rfd.value     as value
    from bo_at_record_field_data rfd
    join bo_at_fields f on f.field_id = rfd.field_id
    join bo_at_tables t on t.table_id = rfd.table_id
    join bo_at_bases  b on b.base_id = t.base_id
    where (${valueSearchPredicate(args.q)} or ${fieldNameSearchPredicate(args.q)})
    ${baseFilter} ${tableFilter}
    limit ${budget + 1}
  `
}

/** Decode a JSON-encoded cell value into a short, truncated snippet. */
export function buildSnippet(rawValue: string | null, maxLen: number = SNIPPET_MAX_LEN): string | null {
  if (rawValue == null) return null
  let decoded: unknown
  try {
    decoded = JSON.parse(rawValue)
  } catch {
    decoded = rawValue
  }
  if (decoded == null) return null
  const text = typeof decoded === 'string' ? decoded : JSON.stringify(decoded)
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '…'
}

/**
 * Trim a candidate-row list to the scan budget, reporting whether the budget was
 * exceeded (the over-fetched `budget + 1`th row → `partial: true`).
 */
export function applyScanBudget<T>(rows: T[], budget: number): { hits: T[]; scanBudgetExceeded: boolean } {
  return { hits: rows.slice(0, budget), scanBudgetExceeded: rows.length > budget }
}

interface ScanRow {
  base_id: string
  base_name: string | null
  table_id: string
  table_name: string | null
  record_id: string
  field_id: string
  value: string | null
}

export interface SearchRecordsArgs {
  q: string
  baseId?: string | null
  tableId?: string | null
  perTableCap?: number
  budget?: number
}

/**
 * Execute the search scan and group the hits base → table with a per-table cap;
 * the scan-budget overflow propagates to the result's `partial` flag.
 */
export async function searchRecords(tx: SpaceTx, args: SearchRecordsArgs): Promise<SearchResult> {
  const budget = args.budget ?? SEARCH_SCAN_BUDGET
  const perTableCap = args.perTableCap ?? SEARCH_PER_TABLE_CAP

  const rows = (await tx.execute(
    buildSearchScanSql({ q: args.q, baseId: args.baseId, tableId: args.tableId, budget }),
  )) as unknown as Iterable<ScanRow>

  const { hits: kept, scanBudgetExceeded } = applyScanBudget([...rows], budget)
  const hits: SearchHit[] = kept.map((r) => ({
    baseId: r.base_id,
    baseName: r.base_name,
    tableId: r.table_id,
    tableName: r.table_name,
    recordId: r.record_id,
    fieldId: r.field_id,
    snippet: buildSnippet(r.value),
  }))

  return groupSearchHits(hits, perTableCap, { scanBudgetExceeded })
}
