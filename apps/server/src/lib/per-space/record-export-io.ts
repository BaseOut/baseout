// I/O + pure helpers for the record-export route (server-data-browse Task 3.5,
// SYNC path + job status). Wraps the already-tested pure serializers in
// record-export.ts (csvLine / csvLines / formatCellForExport / jsonExportShape)
// and executes the scope reads against the per-Space Postgres.
//
// Two paths (design §Export):
//   - sync  (≤ SYNC_THRESHOLD rows): stream CSV/JSON straight from the reader —
//     the route pipes buildCsvLines / jsonExportChunks through a ReadableStream,
//     never buffering the serialized set.
//   - async (above threshold): INSERT a bo_at_export_jobs row (status 'queued');
//     the actual writer is the DEFERRED workflows-data-export follow-up. Nothing
//     is enqueued here.
//
// The SQL shapes are rendered-SQL unit-tested (data-export-io.test.ts); live-PG
// behavior is covered by the deferred integration smoke (Task 5.1).

import { eq, sql, type SQL } from 'drizzle-orm'
import { spacePg } from '@baseout/db-schema/space'
import type { SpaceTx } from './space-db-pg'
import {
  compileFilters,
  orderBySql,
  parseFilters,
  parseSort,
  type RecordFilter,
} from './record-read'
import {
  csvLines,
  formatCellForExport,
  type JsonBaseExport,
  type JsonTableExport,
} from './record-export'

// Sync path is bounded so the Worker never streams an unbounded set inside its
// wall-clock budget. Design §Export blesses "≤ ~10k rows"; we take the more
// conservative 5k for the Worker sync path — anything larger becomes a queued
// job for the deferred workflows writer.
export const SYNC_THRESHOLD = 5_000

// ── Request validation (pure) ────────────────────────────────────────────────

export interface ExportScope {
  baseId?: string
  tableId?: string
  filters?: unknown
  sort?: string
}

export type ValidatedExport =
  | {
      ok: true
      format: 'csv' | 'json'
      scope: { baseId?: string; tableId?: string; sort?: string }
      filters: RecordFilter[]
    }
  | { ok: false; error: 'invalid_request'; param?: string; message: string }

/**
 * Validate the POST body: `{ scope: {baseId?, tableId?, filters?, sort?}, format }`.
 * CSV requires a single-table scope (heterogeneous rows don't fit one CSV);
 * filters are only meaningful on a single table (fieldIds are table-scoped).
 */
export function validateExportRequest(body: unknown): ValidatedExport {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'invalid_request', message: 'body must be a JSON object' }
  }
  const b = body as Record<string, unknown>

  const format = b.format
  if (format !== 'csv' && format !== 'json') {
    return { ok: false, error: 'invalid_request', param: 'format', message: "format must be 'csv' or 'json'" }
  }

  if (typeof b.scope !== 'object' || b.scope === null) {
    return { ok: false, error: 'invalid_request', param: 'scope', message: 'scope is required' }
  }
  const s = b.scope as Record<string, unknown>
  const baseId = typeof s.baseId === 'string' && s.baseId ? s.baseId : undefined
  const tableId = typeof s.tableId === 'string' && s.tableId ? s.tableId : undefined
  const sort = typeof s.sort === 'string' ? s.sort : undefined

  if (!baseId && !tableId) {
    return { ok: false, error: 'invalid_request', param: 'scope', message: 'scope requires a baseId or tableId' }
  }
  if (format === 'csv' && !tableId) {
    return {
      ok: false,
      error: 'invalid_request',
      param: 'scope',
      message: 'CSV export requires a single-table scope (tableId)',
    }
  }

  let filters: RecordFilter[] = []
  if (s.filters != null) {
    // Reuse record-read's parser/validator over the already-parsed array.
    filters = parseFilters(JSON.stringify(s.filters)).filters
    if (filters.length && !tableId) {
      return { ok: false, error: 'invalid_request', param: 'scope', message: 'filters require a tableId scope' }
    }
  }

  return { ok: true, format, scope: { baseId, tableId, sort }, filters }
}

/** Sync when the (capped) scope count is within the threshold; async above it. */
export function decideExportMode(count: number, threshold: number = SYNC_THRESHOLD): 'sync' | 'async' {
  return count > threshold ? 'async' : 'sync'
}

// ── Scope → SQL (pure; rendered-SQL tested) ──────────────────────────────────

/** WHERE for the scope on bo_at_records: single table (tableId wins) or whole
 *  base, AND-ed with the optional compiled filter predicate. */
export function scopeWhereSql(
  scope: { baseId?: string; tableId?: string },
  filterPredicate?: SQL | null,
): SQL {
  const parts: SQL[] = []
  if (scope.tableId) parts.push(sql`bo_at_records.table_id = ${scope.tableId}`)
  else if (scope.baseId) parts.push(sql`bo_at_records.base_id = ${scope.baseId}`)
  if (filterPredicate) parts.push(filterPredicate)
  // Validation guarantees at least the base/table clause.
  return parts.reduce((acc, p) => sql`${acc} and ${p}`)
}

/** Count the scope but stop at `cap + 1` rows — enough to decide sync vs async
 *  without a full count(*) on a huge table. */
export function cappedCountSql(where: SQL, cap: number): SQL {
  return sql`select count(*)::int as c from (select 1 from bo_at_records where ${where} limit ${cap + 1}) s`
}

/** Active fields for a table; primary first, then name (stable CSV header). */
export function tableFieldsSql(tableId: string): SQL {
  return sql`select field_id, name, type from bo_at_fields where table_id = ${tableId} and status = 'active' order by is_primary desc, name asc`
}

/** Records for a table (optional filter predicate), in the export sort order. */
export function tableRecordsSql(tableId: string, filterPredicate: SQL | null, orderBy: SQL): SQL {
  const where = filterPredicate
    ? sql`bo_at_records.table_id = ${tableId} and ${filterPredicate}`
    : sql`bo_at_records.table_id = ${tableId}`
  return sql`select record_id, created_time, modified_time, status from bo_at_records where ${where} order by ${orderBy}`
}

/** Stored (JSON-encoded text) cell values for a set of records in one table. */
export function recordFieldValuesSql(tableId: string, recordIds: string[]): SQL {
  const idList = sql.join(
    recordIds.map((id) => sql`${id}`),
    sql`, `,
  )
  return sql`select record_id, field_id, value from bo_at_record_field_data where table_id = ${tableId} and record_id in (${idList})`
}

/** Active tables in a base (JSON base-scope export). */
export function baseTablesSql(baseId: string): SQL {
  return sql`select table_id, name from bo_at_tables where base_id = ${baseId} and status = 'active' order by name asc`
}

/** A single table's id/name/base (single-table JSON scope). */
export function tableMetaSql(tableId: string): SQL {
  return sql`select table_id, name, base_id from bo_at_tables where table_id = ${tableId} limit 1`
}

/** A base's name for the JSON export envelope. */
export function baseMetaSql(baseId: string): SQL {
  return sql`select base_id, name from bo_at_bases where base_id = ${baseId} limit 1`
}

// ── Assembly (pure; wraps record-export.ts) ──────────────────────────────────

export interface ExportFieldMeta {
  fieldId: string
  name: string | null
  type: string
}

export interface ExportRecordRow {
  recordId: string
  createdTime: string | null
  modifiedTime: string | null
  status: string
  /** fieldId → raw stored (JSON-encoded) value; formatCellForExport decodes it. */
  values: Record<string, string | null>
}

const RECORD_ID_HEADER = 'record_id'

/** CSV header: a record_id column then one column per field (name → id fallback). */
export function csvHeader(fields: ExportFieldMeta[]): string[] {
  return [RECORD_ID_HEADER, ...fields.map((f) => f.name ?? f.fieldId)]
}

/** One CSV field-array for a record; attachments become backup references. */
export function csvRowFor(fields: ExportFieldMeta[], rec: ExportRecordRow): Array<string | null> {
  return [rec.recordId, ...fields.map((f) => formatCellForExport(rec.values[f.fieldId] ?? null, f.type))]
}

/** Streaming CSV lines (header + one per record) — the route pipes this straight
 *  into a ReadableStream, so the serialized set is never buffered. */
export function buildCsvLines(
  fields: ExportFieldMeta[],
  records: Iterable<ExportRecordRow>,
): Generator<string> {
  const rows = (function* () {
    for (const rec of records) yield csvRowFor(fields, rec)
  })()
  return csvLines(csvHeader(fields), rows)
}

/** JSON rows for a table: record_id key + one key per field (name → id fallback). */
export function jsonTableRows(
  fields: ExportFieldMeta[],
  records: Iterable<ExportRecordRow>,
): Array<Record<string, string | null>> {
  const out: Array<Record<string, string | null>> = []
  for (const rec of records) {
    const row: Record<string, string | null> = { [RECORD_ID_HEADER]: rec.recordId }
    for (const f of fields) row[f.name ?? f.fieldId] = formatCellForExport(rec.values[f.fieldId] ?? null, f.type)
    out.push(row)
  }
  return out
}

/**
 * Stream the nested JSON export shape ({ bases → tables → rows }) fragment by
 * fragment so the route never JSON.stringifies the whole set at once. The
 * concatenation of every yielded chunk parses back to jsonExportShape(bases).
 */
export function* jsonExportChunks(shape: { bases: JsonBaseExport[] }): Generator<string> {
  yield '{"bases":['
  for (let bi = 0; bi < shape.bases.length; bi++) {
    const base = shape.bases[bi]!
    if (bi) yield ','
    yield `{"baseId":${JSON.stringify(base.baseId)},"baseName":${JSON.stringify(base.baseName)},"tables":[`
    for (let ti = 0; ti < base.tables.length; ti++) {
      const table = base.tables[ti]!
      if (ti) yield ','
      yield `{"tableId":${JSON.stringify(table.tableId)},"tableName":${JSON.stringify(table.tableName)},"rows":[`
      for (let ri = 0; ri < table.rows.length; ri++) {
        if (ri) yield ','
        yield JSON.stringify(table.rows[ri])
      }
      yield ']}'
    }
    yield ']}'
  }
  yield ']}'
}

// ── I/O (executes the above against the per-Space Postgres) ──────────────────

function tsIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

/** Capped scope count for the sync-vs-async decision. */
export async function cappedScopeCount(
  tx: SpaceTx,
  scope: { baseId?: string; tableId?: string },
  filters: RecordFilter[],
): Promise<number> {
  const predicate = scope.tableId ? compileFilters(scope.tableId, filters).predicate : null
  const where = scopeWhereSql(scope, predicate)
  const rows = (await tx.execute(cappedCountSql(where, SYNC_THRESHOLD))) as unknown as Iterable<{ c: number }>
  return Number([...rows][0]?.c ?? 0)
}

async function fetchFieldValues(
  tx: SpaceTx,
  tableId: string,
  recordIds: string[],
): Promise<Map<string, Record<string, string | null>>> {
  const out = new Map<string, Record<string, string | null>>()
  if (recordIds.length === 0) return out
  const rows = (await tx.execute(recordFieldValuesSql(tableId, recordIds))) as unknown as Iterable<{
    record_id: string
    field_id: string
    value: string | null
  }>
  for (const r of rows) {
    let rec = out.get(r.record_id)
    if (!rec) {
      rec = {}
      out.set(r.record_id, rec)
    }
    rec[r.field_id] = r.value
  }
  return out
}

async function fetchTableExport(
  tx: SpaceTx,
  tableId: string,
  filterPredicate: SQL | null,
  orderBy: SQL,
): Promise<{ fields: ExportFieldMeta[]; records: ExportRecordRow[] }> {
  const fieldRows = (await tx.execute(tableFieldsSql(tableId))) as unknown as Iterable<{
    field_id: string
    name: string | null
    type: string
  }>
  const fields: ExportFieldMeta[] = [...fieldRows].map((f) => ({
    fieldId: f.field_id,
    name: f.name,
    type: f.type,
  }))

  const recRows = (await tx.execute(tableRecordsSql(tableId, filterPredicate, orderBy))) as unknown as Iterable<{
    record_id: string
    created_time: unknown
    modified_time: unknown
    status: string
  }>
  const recs = [...recRows]
  const values = await fetchFieldValues(tx, tableId, recs.map((r) => r.record_id))
  const records: ExportRecordRow[] = recs.map((r) => ({
    recordId: r.record_id,
    createdTime: tsIso(r.created_time),
    modifiedTime: tsIso(r.modified_time),
    status: r.status,
    values: values.get(r.record_id) ?? {},
  }))
  return { fields, records }
}

export interface FetchExportArgs {
  format: 'csv' | 'json'
  scope: { baseId?: string; tableId?: string; sort?: string }
  filters: RecordFilter[]
}

export type ExportPayload =
  | { kind: 'csv'; fields: ExportFieldMeta[]; records: ExportRecordRow[]; rowCount: number }
  | { kind: 'json'; bases: JsonBaseExport[]; rowCount: number }

/** Read the whole scope's data for the sync path. Runs inside withSpaceSchema. */
export async function fetchExportData(tx: SpaceTx, args: FetchExportArgs): Promise<ExportPayload> {
  const { sort } = parseSort(args.scope.sort) // field-value sorts fall back to record_id
  const orderBy = orderBySql(sort)

  if (args.format === 'csv') {
    const tableId = args.scope.tableId! // validated present for CSV
    const { predicate } = compileFilters(tableId, args.filters)
    const { fields, records } = await fetchTableExport(tx, tableId, predicate, orderBy)
    return { kind: 'csv', fields, records, rowCount: records.length }
  }

  // JSON: single table, or every active table in the base.
  let baseId: string
  let tableMetas: Array<{ tableId: string; tableName: string | null }>
  if (args.scope.tableId) {
    const metaRows = (await tx.execute(tableMetaSql(args.scope.tableId))) as unknown as Iterable<{
      table_id: string
      name: string | null
      base_id: string
    }>
    const meta = [...metaRows][0]
    baseId = meta?.base_id ?? args.scope.baseId ?? ''
    tableMetas = [{ tableId: args.scope.tableId, tableName: meta?.name ?? null }]
  } else {
    baseId = args.scope.baseId!
    const tblRows = (await tx.execute(baseTablesSql(baseId))) as unknown as Iterable<{
      table_id: string
      name: string | null
    }>
    tableMetas = [...tblRows].map((t) => ({ tableId: t.table_id, tableName: t.name }))
  }

  const baseRows = (await tx.execute(baseMetaSql(baseId))) as unknown as Iterable<{
    base_id: string
    name: string | null
  }>
  const baseName = [...baseRows][0]?.name ?? null

  const tables: JsonTableExport[] = []
  let rowCount = 0
  for (const { tableId, tableName } of tableMetas) {
    // Filters only apply to a single-table scope (validated).
    const predicate = args.scope.tableId ? compileFilters(tableId, args.filters).predicate : null
    const { fields, records } = await fetchTableExport(tx, tableId, predicate, orderBy)
    tables.push({ tableId, tableName, rows: jsonTableRows(fields, records) })
    rowCount += records.length
  }

  const bases: JsonBaseExport[] = [{ baseId, baseName, tables }]
  return { kind: 'json', bases, rowCount }
}

// ── Export-job rows (async path record + status read) ────────────────────────

export interface ExportJobRow {
  id: string
  status: string
  format: string
  outputLocation: string | null
  rowCount: number | null
  error: string | null
  createdAt: string | null
  completedAt: string | null
}

/** INSERT a queued export job; returns its id. The workflows writer (deferred)
 *  picks it up — nothing is enqueued here. */
export async function insertExportJob(
  tx: SpaceTx,
  args: { scope: unknown; format: 'csv' | 'json' },
): Promise<string> {
  const [row] = await tx
    .insert(spacePg.exportJobs)
    .values({ scope: args.scope, format: args.format, status: 'queued' })
    .returning({ id: spacePg.exportJobs.id })
  return row!.id
}

/** Read an export job's status row, or null if the id is unknown. */
export async function readExportJob(tx: SpaceTx, jobId: string): Promise<ExportJobRow | null> {
  const [row] = await tx
    .select({
      id: spacePg.exportJobs.id,
      status: spacePg.exportJobs.status,
      format: spacePg.exportJobs.format,
      outputLocation: spacePg.exportJobs.outputLocation,
      rowCount: spacePg.exportJobs.rowCount,
      error: spacePg.exportJobs.error,
      createdAt: spacePg.exportJobs.createdAt,
      completedAt: spacePg.exportJobs.completedAt,
    })
    .from(spacePg.exportJobs)
    .where(eq(spacePg.exportJobs.id, jobId))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    format: row.format,
    outputLocation: row.outputLocation,
    rowCount: row.rowCount,
    error: row.error,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  }
}
