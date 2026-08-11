// I/O + pure query builders for the Space-wide record changelog route
// (server-data-browse Task 3.3). Sibling to record-read-io.ts (the records
// list) and to the SCHEMA-side changelog (schema-changelog-io.ts) — this is the
// changelog over RECORD data.
//
// Two views (design.md §Changelog):
//   - Rollup: one row per per-base run (bo_at_base_runs) with created / updated /
//     deleted record counts. created = records whose first_seen_run = run,
//     deleted = first_unseen_run = run, updated = distinct record_ids in
//     bo_at_record_updates for that run. Keyset-paginated newest-first over the
//     run timeline (started_at desc, id desc).
//   - Rows: when a specific `runId` is requested, a keyset-paginated list of the
//     records affected by that run for one changeType (created | updated |
//     deleted), record_id-ascending.
//
// All filters (baseId / tableId / fieldId / from / to / fromRun / toRun) compile
// to BOUND parameters — never string-concatenated values. The rendered SQL is
// unit-tested via PgDialect().sqlToQuery in
// tests/integration/per-space/data-changelog-io.test.ts; live-PG behaviour
// (correct counts + paging on real rows) rides the deferred integration smoke
// (Task 5.1). NB: a per-base run (bo_at_base_runs) is already scoped to a single
// base, so the base filter is applied on the run driver; table/field filters are
// applied inside the per-run count subqueries and on the row queries.

import { sql, type SQL } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'
import { clampPageSize, encodeCursor, type Cursor } from './record-read'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const CHANGE_TYPES = ['created', 'updated', 'deleted'] as const
export type ChangeType = (typeof CHANGE_TYPES)[number]

export interface ChangelogFilters {
  baseId: string | null
  tableId: string | null
  fieldId: string | null
  from: string | null // ISO — inclusive lower bound on run started_at
  to: string | null // ISO — inclusive upper bound on run started_at
  fromRun: string | null // run uuid — bound on started_at via the run's own timestamp
  toRun: string | null // run uuid — bound on started_at via the run's own timestamp
}

export interface ParsedChangelogRequest {
  /** `rows` when a specific `runId` is requested; otherwise the per-run `rollup`. */
  mode: 'rollup' | 'rows'
  runId: string | null
  /** Which affected-record set the `rows` view lists. Defaults to `updated` in rows mode. */
  changeType: ChangeType | null
  filters: ChangelogFilters
  limit: number
  errors: string[]
}

const emptyToNull = (s: string | null): string | null => (s && s.length > 0 ? s : null)

/**
 * Parse + validate the changelog query params (pure — no I/O). `runId` selects
 * the rows view; its presence is the mode switch. run-id params are UUID-checked
 * and date params ISO-checked so the route 400s on garbage rather than binding it.
 */
export function parseChangelogRequest(sp: URLSearchParams): ParsedChangelogRequest {
  const errors: string[] = []

  const runId = emptyToNull(sp.get('runId'))
  const fromRun = emptyToNull(sp.get('fromRun'))
  const toRun = emptyToNull(sp.get('toRun'))
  for (const [name, val] of [
    ['runId', runId],
    ['fromRun', fromRun],
    ['toRun', toRun],
  ] as const) {
    if (val && !UUID_RE.test(val)) errors.push(`${name} must be a UUID`)
  }

  let changeType: ChangeType | null = null
  const ctRaw = emptyToNull(sp.get('changeType'))
  if (ctRaw) {
    if ((CHANGE_TYPES as readonly string[]).includes(ctRaw)) changeType = ctRaw as ChangeType
    else errors.push(`changeType must be one of ${CHANGE_TYPES.join('|')}`)
  }

  const from = emptyToNull(sp.get('from'))
  const to = emptyToNull(sp.get('to'))
  for (const [name, val] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (val && Number.isNaN(Date.parse(val))) errors.push(`${name} must be an ISO-8601 date`)
  }

  const mode: 'rollup' | 'rows' = runId ? 'rows' : 'rollup'
  // Rows view needs a set to list; default to `updated` when unspecified.
  const effectiveChangeType = mode === 'rows' ? (changeType ?? 'updated') : changeType

  return {
    mode,
    runId,
    changeType: effectiveChangeType,
    filters: {
      baseId: emptyToNull(sp.get('baseId')),
      tableId: emptyToNull(sp.get('tableId')),
      fieldId: emptyToNull(sp.get('fieldId')),
      from,
      to,
      fromRun,
      toRun,
    },
    limit: clampPageSize(sp.get('limit')),
    errors,
  }
}

// ── SQL builders (pure) ──────────────────────────────────────────────────────

/** Per-run count of records created (first_seen_run) or deleted (first_unseen_run). */
function lifecycleCountSql(column: 'first_seen_run' | 'first_unseen_run', f: ChangelogFilters): SQL {
  const col = column === 'first_seen_run' ? sql`rec.first_seen_run` : sql`rec.first_unseen_run`
  return sql`(select count(*)::int from bo_at_records rec where ${col} = r.id${
    f.tableId ? sql` and rec.table_id = ${f.tableId}` : sql``
  })`
}

/** Per-run count of distinct records with a superseded-value log entry. */
function updatedCountSql(f: ChangelogFilters): SQL {
  return sql`(select count(distinct ru.record_id)::int from bo_at_record_updates ru where ru.run_id = r.id${
    f.tableId ? sql` and ru.table_id = ${f.tableId}` : sql``
  }${f.fieldId ? sql` and ru.field_id = ${f.fieldId}` : sql``})`
}

/** "Row strictly after the cursor" over the run timeline (started_at desc, id desc). */
function rollupKeysetAfter(cursor: Cursor | null): SQL | null {
  if (!cursor) return null
  const runId = cursor.recordId
  const v = cursor.sortValue
  if (v === null) {
    // Already in the NULLS-LAST tail: only null-started runs remain, id-tiebroken.
    return sql`(r.started_at is null and r.id < ${runId}::uuid)`
  }
  return sql`(r.started_at < ${v}::timestamptz or r.started_at is null or (r.started_at = ${v}::timestamptz and r.id < ${runId}::uuid))`
}

function runWhere(f: ChangelogFilters, cursor: Cursor | null): SQL {
  const parts: SQL[] = [sql`true`]
  if (f.baseId) parts.push(sql`r.base_id = ${f.baseId}`)
  if (f.from) parts.push(sql`r.started_at >= ${f.from}::timestamptz`)
  if (f.to) parts.push(sql`r.started_at <= ${f.to}::timestamptz`)
  if (f.fromRun) parts.push(sql`r.started_at >= (select started_at from bo_at_base_runs where id = ${f.fromRun}::uuid)`)
  if (f.toRun) parts.push(sql`r.started_at <= (select started_at from bo_at_base_runs where id = ${f.toRun}::uuid)`)
  const after = rollupKeysetAfter(cursor)
  if (after) parts.push(after)
  return parts.reduce((acc, p) => sql`${acc} and ${p}`)
}

export interface RollupQueryArgs {
  filters: ChangelogFilters
  cursor: Cursor | null
  limit: number
}

export function buildRollupQuery(args: RollupQueryArgs): SQL {
  const take = args.limit + 1
  return sql`
    select
      r.id as run_id,
      r.base_id,
      r.started_at,
      r.completed_at,
      ${lifecycleCountSql('first_seen_run', args.filters)} as created_count,
      ${lifecycleCountSql('first_unseen_run', args.filters)} as deleted_count,
      ${updatedCountSql(args.filters)} as updated_count
    from bo_at_base_runs r
    where ${runWhere(args.filters, args.cursor)}
    order by r.started_at desc nulls last, r.id desc
    limit ${take}
  `
}

export interface RowsQueryArgs {
  runId: string
  changeType: ChangeType
  filters: ChangelogFilters
  cursor: Cursor | null
  limit: number
}

export function buildRowsQuery(args: RowsQueryArgs): SQL {
  const { runId, changeType, filters: f, cursor, limit } = args
  const take = limit + 1
  const afterId = cursor ? cursor.recordId : null

  if (changeType === 'updated') {
    // Distinct affected records + the set of fields that changed this run. Joined
    // to bo_at_records to enrich (base/created/modified/status) and to allow the
    // base filter (bo_at_record_updates carries no base_id).
    return sql`
      select
        ru.record_id,
        ru.table_id,
        rec.base_id,
        rec.created_time,
        rec.modified_time,
        rec.status,
        array_agg(distinct ru.field_id) as changed_field_ids
      from bo_at_record_updates ru
      left join bo_at_records rec on rec.record_id = ru.record_id
      where ru.run_id = ${runId}::uuid${
        f.tableId ? sql` and ru.table_id = ${f.tableId}` : sql``
      }${f.fieldId ? sql` and ru.field_id = ${f.fieldId}` : sql``}${
        f.baseId ? sql` and rec.base_id = ${f.baseId}` : sql``
      }${afterId ? sql` and ru.record_id > ${afterId}` : sql``}
      group by ru.record_id, ru.table_id, rec.base_id, rec.created_time, rec.modified_time, rec.status
      order by ru.record_id asc
      limit ${take}
    `
  }

  // created | deleted → driven by the bo_at_records lifecycle column.
  const col = changeType === 'created' ? sql`rec.first_seen_run` : sql`rec.first_unseen_run`
  return sql`
    select rec.record_id, rec.table_id, rec.base_id, rec.created_time, rec.modified_time, rec.status
    from bo_at_records rec
    where ${col} = ${runId}::uuid${
      f.baseId ? sql` and rec.base_id = ${f.baseId}` : sql``
    }${f.tableId ? sql` and rec.table_id = ${f.tableId}` : sql``}${
      afterId ? sql` and rec.record_id > ${afterId}` : sql``
    }
    order by rec.record_id asc
    limit ${take}
  `
}

// ── Executors ────────────────────────────────────────────────────────────────

function tsIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => x != null).map((x) => String(x))
  return []
}

export interface RollupRun {
  runId: string
  startedAt: string | null
  completedAt: string | null
  createdCount: number
  updatedCount: number
  deletedCount: number
}

export interface RollupPage {
  runs: RollupRun[]
  nextCursor: string | null
}

export async function queryChangelogRollup(tx: SpaceTx, args: RollupQueryArgs): Promise<RollupPage> {
  const rows = (await tx.execute(buildRollupQuery(args))) as unknown as Iterable<{
    run_id: string
    started_at: unknown
    completed_at: unknown
    created_count: number
    deleted_count: number
    updated_count: number
  }>
  const page = [...rows]
  let nextCursor: string | null = null
  if (page.length > args.limit) {
    page.length = args.limit
    const last = page[page.length - 1]!
    nextCursor = encodeCursor({
      sortField: 'started_at',
      sortValue: tsIso(last.started_at),
      recordId: last.run_id,
    })
  }
  return {
    runs: page.map((r) => ({
      runId: r.run_id,
      startedAt: tsIso(r.started_at),
      completedAt: tsIso(r.completed_at),
      createdCount: Number(r.created_count ?? 0),
      updatedCount: Number(r.updated_count ?? 0),
      deletedCount: Number(r.deleted_count ?? 0),
    })),
    nextCursor,
  }
}

export interface ChangelogRow {
  recordId: string
  tableId: string | null
  baseId: string | null
  changeType: ChangeType
  createdTime: string | null
  modifiedTime: string | null
  status: string | null
  /** Only present for the `updated` view. */
  changedFieldIds?: string[]
}

export interface RowsPage {
  rows: ChangelogRow[]
  nextCursor: string | null
}

export async function queryChangelogRows(tx: SpaceTx, args: RowsQueryArgs): Promise<RowsPage> {
  const rows = (await tx.execute(buildRowsQuery(args))) as unknown as Iterable<{
    record_id: string
    table_id: string | null
    base_id: string | null
    created_time: unknown
    modified_time: unknown
    status: string | null
    changed_field_ids?: unknown
  }>
  const page = [...rows]
  let nextCursor: string | null = null
  if (page.length > args.limit) {
    page.length = args.limit
    const last = page[page.length - 1]!
    nextCursor = encodeCursor({ sortField: 'record_id', sortValue: last.record_id, recordId: last.record_id })
  }
  return {
    rows: page.map((r) => ({
      recordId: r.record_id,
      tableId: r.table_id ?? null,
      baseId: r.base_id ?? null,
      changeType: args.changeType,
      createdTime: tsIso(r.created_time),
      modifiedTime: tsIso(r.modified_time),
      status: r.status ?? null,
      ...(args.changeType === 'updated' ? { changedFieldIds: toStringArray(r.changed_field_ids) } : {}),
    })),
    nextCursor,
  }
}
