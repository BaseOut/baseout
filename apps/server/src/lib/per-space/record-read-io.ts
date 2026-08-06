// I/O layer for the records-list route (server-data-browse Task 3.1). Executes
// the pure builders in record-read.ts against the per-Space Postgres. The SQL
// shapes (filter compile, keyset, order-by, page-size clamp) are rendered-SQL
// unit-tested in record-read.test.ts; live-PG behavior (index use, correct
// paging on real rows) is covered by the deferred integration smoke (Task 5.1).
//
// `bo_at_record_field_data.value` is JSON-encoded text — decoded back to the
// native JS value on the way out.

import { sql } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'
import {
  compileFilters,
  encodeCursor,
  keysetAfter,
  orderBySql,
  type Cursor,
  type RecordFilter,
  type RecordSort,
} from './record-read'

// Exact count is reported up to this cap; beyond it the total is flagged
// `approximate` (design §Pagination: "exact count(*) up to N (e.g. 50k)").
const APPROX_COUNT_CAP = 50_000

export interface RecordRow {
  recordId: string
  createdTime: string | null
  modifiedTime: string | null
  status: string
  fields: Record<string, unknown>
}

export interface RecordsPage {
  records: RecordRow[]
  nextCursor: string | null
  total: number
  approximate: boolean
  filterErrors: string[]
}

export interface QueryRecordsArgs {
  tableId: string
  filters: RecordFilter[]
  sort: RecordSort
  cursor: Cursor | null
  limit: number
  fields: string[] | null
}

function tsIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function decodeValue(v: string | null): unknown {
  if (v == null) return null
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

function cursorFor(
  sort: RecordSort,
  row: { record_id: string; created_time: unknown; modified_time: unknown },
): Cursor {
  if (sort.column === 'record_id') {
    return { sortField: 'record_id', sortValue: row.record_id, recordId: row.record_id }
  }
  const raw = sort.column === 'created_time' ? row.created_time : row.modified_time
  return { sortField: sort.column, sortValue: tsIso(raw), recordId: row.record_id }
}

async function fetchFieldValues(
  tx: SpaceTx,
  tableId: string,
  recordIds: string[],
  fields: string[] | null,
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  if (recordIds.length === 0) return out
  const idList = sql.join(
    recordIds.map((id) => sql`${id}`),
    sql`, `,
  )
  const fieldPred =
    fields && fields.length
      ? sql`and field_id in (${sql.join(
          fields.map((f) => sql`${f}`),
          sql`, `,
        )})`
      : sql``
  const rows = (await tx.execute(sql`
    select record_id, field_id, value
    from bo_at_record_field_data
    where table_id = ${tableId} and record_id in (${idList}) ${fieldPred}
  `)) as unknown as Iterable<{ record_id: string; field_id: string; value: string | null }>
  for (const r of rows) {
    let rec = out.get(r.record_id)
    if (!rec) {
      rec = {}
      out.set(r.record_id, rec)
    }
    rec[r.field_id] = decodeValue(r.value)
  }
  return out
}

async function approxTotal(
  tx: SpaceTx,
  tableId: string,
  predicate: SQLish,
): Promise<{ count: number; approximate: boolean }> {
  const where = predicate
    ? sql`bo_at_records.table_id = ${tableId} and ${predicate}`
    : sql`bo_at_records.table_id = ${tableId}`
  const rows = (await tx.execute(sql`
    select count(*)::int as c from (
      select 1 from bo_at_records where ${where} limit ${APPROX_COUNT_CAP + 1}
    ) s
  `)) as unknown as Iterable<{ c: number }>
  const first = [...rows][0]
  const c = Number(first?.c ?? 0)
  return c > APPROX_COUNT_CAP
    ? { count: APPROX_COUNT_CAP, approximate: true }
    : { count: c, approximate: false }
}

type SQLish = ReturnType<typeof compileFilters>['predicate']

export async function queryRecordsPage(tx: SpaceTx, args: QueryRecordsArgs): Promise<RecordsPage> {
  const { predicate, errors } = compileFilters(args.tableId, args.filters)
  const after = keysetAfter(args.sort, args.cursor)

  const whereParts = [sql`bo_at_records.table_id = ${args.tableId}`]
  if (predicate) whereParts.push(predicate)
  if (after) whereParts.push(after)
  const where = whereParts.reduce((acc, p) => sql`${acc} and ${p}`)

  const take = args.limit + 1
  const rows = (await tx.execute(sql`
    select record_id, created_time, modified_time, status
    from bo_at_records
    where ${where}
    order by ${orderBySql(args.sort)}
    limit ${take}
  `)) as unknown as Iterable<{
    record_id: string
    created_time: unknown
    modified_time: unknown
    status: string
  }>

  const page = [...rows]
  let nextCursor: string | null = null
  if (page.length > args.limit) {
    page.length = args.limit
    nextCursor = encodeCursor(cursorFor(args.sort, page[page.length - 1]!))
  }

  const recordIds = page.map((r) => r.record_id)
  const fields = await fetchFieldValues(tx, args.tableId, recordIds, args.fields)
  const total = await approxTotal(tx, args.tableId, predicate)

  return {
    records: page.map((r) => ({
      recordId: r.record_id,
      createdTime: tsIso(r.created_time),
      modifiedTime: tsIso(r.modified_time),
      status: r.status,
      fields: fields.get(r.record_id) ?? {},
    })),
    nextCursor,
    total: total.count,
    approximate: total.approximate,
    filterErrors: errors,
  }
}
