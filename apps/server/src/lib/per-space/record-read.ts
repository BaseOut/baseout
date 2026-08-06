// Pure query layer for the /data record browser (server-data-browse Task 1.1).
// No I/O — builds parameterized Drizzle SQL fragments (never string-concatenated
// values) and encodes/decodes the opaque keyset cursor. The -io side executes
// these against the per-Space Postgres. Unit-tested via PgDialect().sqlToQuery.
//
// `bo_at_record_field_data.value` is JSON-encoded text (sparse-until-first-value:
// no row = never populated, value IS NULL = cleared). Filters compile to an
// EXISTS (or NOT EXISTS) correlated on bo_at_records.record_id.

import { sql, type SQL } from 'drizzle-orm'

// ── Keyset cursor codec ──────────────────────────────────────────────────────
// Cursor = base64url(JSON({sortField, sortValue, recordId})). recordId tiebreaks
// duplicate sort values (design: pagination is keyset, never offset).

export interface Cursor {
  sortField: string // 'record_id' | a fieldId
  sortValue: string | null
  recordId: string
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function encodeCursor(c: Cursor): string {
  return b64urlEncode(JSON.stringify({ s: c.sortField, v: c.sortValue, r: c.recordId }))
}

export function decodeCursor(token: string): Cursor | null {
  if (!token) return null
  const json = b64urlDecode(token)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const o = parsed as Record<string, unknown>
  if (typeof o.s !== 'string' || typeof o.r !== 'string') return null
  if (o.v !== null && typeof o.v !== 'string') return null
  return { sortField: o.s, sortValue: o.v as string | null, recordId: o.r }
}

// ── Filter compiler ──────────────────────────────────────────────────────────

export type FieldKind = 'text' | 'number' | 'date' | 'select' | 'multiSelect' | 'checkbox' | 'linked'
export type FilterOp =
  | 'contains'
  | 'equals'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'eq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is'
  | 'anyOf'
  | 'containsRecordId'

export interface RecordFilter {
  fieldId: string
  kind: FieldKind
  op: FilterOp
  value?: string | number | boolean | Array<string | number>
}

export const MAX_FILTERS = 10

// Guards keep a stray non-conforming value (retyped field) from erroring the
// cast — the value is skipped, never the query.
const NUMERIC_GUARD = sql`rfd.value ~ '^-?[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?$'`
const DATE_GUARD = sql`rfd.value like '"%"'`

/** LIKE-escape user text so % and _ are literal inside a contains pattern. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

const NUMERIC_OPS: Record<string, string> = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' }

/** The inner predicate on `rfd.value` for a populated-value filter, or null if
 *  the (kind, op) pair is unsupported. */
function valuePredicate(f: RecordFilter): SQL | null {
  const { kind, op, value } = f
  switch (kind) {
    case 'text':
      if (op === 'contains' && value != null) {
        return sql`rfd.value ilike ${'%' + escapeLike(String(value)) + '%'}`
      }
      if (op === 'equals' && value != null) return sql`rfd.value = ${JSON.stringify(String(value))}`
      return null
    case 'select':
      if (op === 'is' && value != null) return sql`rfd.value = ${JSON.stringify(String(value))}`
      if (op === 'anyOf' && Array.isArray(value)) {
        return sql`jsonb_exists_any(rfd.value::jsonb, ${value.map(String)})`
      }
      return null
    case 'multiSelect':
      if (op === 'anyOf' && Array.isArray(value)) {
        return sql`jsonb_exists_any(rfd.value::jsonb, ${value.map(String)})`
      }
      if (op === 'is' && value != null) return sql`jsonb_exists(rfd.value::jsonb, ${String(value)})`
      return null
    case 'checkbox':
      if (op === 'is' && typeof value === 'boolean') return sql`rfd.value = ${JSON.stringify(value)}`
      return null
    case 'number': {
      if (op === 'between' && Array.isArray(value) && value.length === 2) {
        return sql`${NUMERIC_GUARD} and (rfd.value)::numeric between ${value[0]} and ${value[1]}`
      }
      const cmp = NUMERIC_OPS[op]
      if (cmp && typeof value === 'number') {
        return sql`${NUMERIC_GUARD} and (rfd.value)::numeric ${sql.raw(cmp)} ${value}`
      }
      return null
    }
    case 'date': {
      // value is a JSON-encoded ISO string ("2026-…"); strip the quotes, cast.
      const asTs = sql`(trim(both '"' from rfd.value))::timestamptz`
      if (op === 'between' && Array.isArray(value) && value.length === 2) {
        return sql`${DATE_GUARD} and ${asTs} between ${String(value[0])} and ${String(value[1])}`
      }
      const cmp = NUMERIC_OPS[op]
      if (cmp && value != null) {
        return sql`${DATE_GUARD} and ${asTs} ${sql.raw(cmp)} ${String(value)}`
      }
      return null
    }
    case 'linked':
      if (op === 'containsRecordId' && value != null) {
        return sql`jsonb_exists(rfd.value::jsonb, ${String(value)})`
      }
      return null
    default:
      return null
  }
}

/** EXISTS a populated row matching `valuePred`, correlated on the outer record. */
function existsFor(tableId: string, fieldId: string, valuePred: SQL): SQL {
  return sql`exists (select 1 from bo_at_record_field_data rfd where rfd.table_id = ${tableId} and rfd.field_id = ${fieldId} and rfd.record_id = bo_at_records.record_id and ${valuePred})`
}

/** Whether the record has NO populated (non-null) value for the field. */
function notPopulated(tableId: string, fieldId: string): SQL {
  return sql`not exists (select 1 from bo_at_record_field_data rfd where rfd.table_id = ${tableId} and rfd.field_id = ${fieldId} and rfd.record_id = bo_at_records.record_id and rfd.value is not null)`
}

/**
 * Compile typed filters into a single AND-ed SQL predicate correlated on
 * bo_at_records. Returns `{ predicate: null }` for no filters. Unsupported
 * (kind, op) pairs and over-cap filters are reported in `errors` and dropped.
 */
export function compileFilters(
  tableId: string,
  filters: RecordFilter[],
): { predicate: SQL | null; errors: string[] } {
  const errors: string[] = []
  const clauses: SQL[] = []
  const used = filters.slice(0, MAX_FILTERS)
  if (filters.length > MAX_FILTERS) {
    errors.push(`Too many filters (${filters.length}); the maximum is ${MAX_FILTERS}.`)
  }

  for (const f of used) {
    if (f.op === 'isEmpty') {
      clauses.push(notPopulated(tableId, f.fieldId))
      continue
    }
    if (f.op === 'isNotEmpty') {
      clauses.push(sql`exists (select 1 from bo_at_record_field_data rfd where rfd.table_id = ${tableId} and rfd.field_id = ${f.fieldId} and rfd.record_id = bo_at_records.record_id and rfd.value is not null)`)
      continue
    }
    const pred = valuePredicate(f)
    if (!pred) {
      errors.push(`Unsupported operator "${f.op}" for a ${f.kind} field (${f.fieldId}).`)
      continue
    }
    clauses.push(existsFor(tableId, f.fieldId, pred))
  }

  if (clauses.length === 0) return { predicate: null, errors }
  const predicate = clauses.reduce((acc, c) => sql`${acc} and ${c}`)
  return { predicate, errors }
}

// ── Records-list page: sort, keyset, param parsing (Task 3.1) ────────────────
// The record-io side executes these; all are pure and rendered-SQL-tested.
// Design (§Pagination) blesses record-column sort as the acceptable first cut
// ("restrict sort to indexed record columns (createdTime/modifiedTime) first
// and note the limitation to the UI"). Sorting by a *field value* is a
// documented follow-up: parseSort returns `error:'unsupported_sort'` so the
// route 400s rather than silently mis-sorting.

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200 // design §Route-level: "max page size 200"

/** Clamp a `limit` query param to [1, MAX_PAGE_SIZE]; default on absent/garbage. */
export function clampPageSize(param: string | null | undefined): number {
  const n = param == null || param === '' ? NaN : Number(param)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(Math.floor(n), MAX_PAGE_SIZE)
}

export type SortColumn = 'record_id' | 'created_time' | 'modified_time'
const SORT_COLUMNS: SortColumn[] = ['record_id', 'created_time', 'modified_time']
export interface RecordSort {
  column: SortColumn
  dir: 'asc' | 'desc'
}

/** Parse a `<field>:<dir>` sort param. Unknown (field-value) fields → error. */
export function parseSort(param: string | null | undefined): {
  sort: RecordSort
  error: 'unsupported_sort' | null
} {
  const fallback: RecordSort = { column: 'record_id', dir: 'asc' }
  if (!param) return { sort: fallback, error: null }
  const [rawCol, rawDir] = param.split(':')
  const dir: 'asc' | 'desc' = rawDir === 'desc' ? 'desc' : 'asc'
  if (!SORT_COLUMNS.includes(rawCol as SortColumn)) return { sort: fallback, error: 'unsupported_sort' }
  return { sort: { column: rawCol as SortColumn, dir }, error: null }
}

/** Parse the `filters` query param (URL-encoded JSON array of RecordFilter). */
export function parseFilters(param: string | null | undefined): {
  filters: RecordFilter[]
  errors: string[]
} {
  if (!param) return { filters: [], errors: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(param)
  } catch {
    return { filters: [], errors: ['filters: invalid JSON'] }
  }
  if (!Array.isArray(parsed)) return { filters: [], errors: ['filters: expected an array'] }
  const filters: RecordFilter[] = []
  const errors: string[] = []
  parsed.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`filters[${i}]: not an object`)
      return
    }
    const o = raw as Record<string, unknown>
    if (typeof o.fieldId !== 'string' || typeof o.kind !== 'string' || typeof o.op !== 'string') {
      errors.push(`filters[${i}]: fieldId, kind and op are required`)
      return
    }
    filters.push({
      fieldId: o.fieldId,
      kind: o.kind as FieldKind,
      op: o.op as FilterOp,
      value: o.value as RecordFilter['value'],
    })
  })
  return { filters, errors }
}

const SORT_COL_SQL: Record<Exclude<SortColumn, 'record_id'>, SQL> = {
  created_time: sql`bo_at_records.created_time`,
  modified_time: sql`bo_at_records.modified_time`,
}

/** ORDER BY for the page query. Timestamps sort NULLS LAST (both dirs) with a
 *  record_id tiebreak so the keyset tuple is total. */
export function orderBySql(sort: RecordSort): SQL {
  if (sort.column === 'record_id') {
    return sort.dir === 'asc'
      ? sql`bo_at_records.record_id asc`
      : sql`bo_at_records.record_id desc`
  }
  const col = SORT_COL_SQL[sort.column]
  return sort.dir === 'asc'
    ? sql`${col} asc nulls last, bo_at_records.record_id asc`
    : sql`${col} desc nulls last, bo_at_records.record_id asc`
}

/** "Row strictly after the cursor" predicate for keyset paging. `null` when no
 *  cursor. Timestamp columns keep NULLS LAST in both directions (the null tail
 *  is reached once cursor.sortValue is null). */
export function keysetAfter(sort: RecordSort, cursor: Cursor | null): SQL | null {
  if (!cursor) return null
  const rid = cursor.recordId
  if (sort.column === 'record_id') {
    return sort.dir === 'asc'
      ? sql`bo_at_records.record_id > ${rid}`
      : sql`bo_at_records.record_id < ${rid}`
  }
  const col = SORT_COL_SQL[sort.column]
  const v = cursor.sortValue
  if (v === null) {
    // Already in the NULLS-LAST tail: only null-valued rows remain, tiebroken.
    return sql`(${col} is null and bo_at_records.record_id > ${rid})`
  }
  const beyond = sort.dir === 'asc' ? sql`${col} > ${v}::timestamptz` : sql`${col} < ${v}::timestamptz`
  return sql`(${beyond} or ${col} is null or (${col} = ${v}::timestamptz and bo_at_records.record_id > ${rid}))`
}
