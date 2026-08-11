// I/O layer for the linked-record-expansion + cell-provenance routes
// (server-data-browse Task 3.2b). Wraps the pure interpreter in
// record-provenance.ts (interpretProvenance / parseLinkIds / pageLinkIds /
// linkedSetPredicate / primaryFieldSearchPredicate / markMissing) with the reads
// that hydrate a page of linked records and resolve a formula/lookup/rollup
// cell's inputs against the per-Space Postgres. One level per call — no
// server-side recursion (the UI walks the graph one hop per user action).
//
// The assembled SQL fragments are rendered-SQL unit-tested in
// data-provenance-io.test.ts (PgDialect, no live PG); live-PG behavior (real
// paging + hydration on seeded rows) is the deferred integration smoke (Task
// 5.1). `bo_at_record_field_data.value` is JSON-encoded text — decoded on the
// way out; `bo_at_fields.options` is jsonb (already an object off the wire).

import { sql, type SQL } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'
import {
  interpretProvenance,
  parseLinkIds,
  pageLinkIds,
  linkedSetPredicate,
  primaryFieldSearchPredicate,
  markMissing,
} from './record-provenance'

// A linked-record row's preview surfaces the primary display value plus a small
// deterministic slice of the linked table's other fields (design §Provenance &
// link expansion: "primary-field display value + a few preview fields").
export const PREVIEW_FIELD_LIMIT = 3

// ── Pure SQL builders (rendered-SQL tested; no I/O) ──────────────────────────

/** Field metadata (type + options drive interpretProvenance; name/type feed the
 *  referenced/looked-up field entries). Works for one id or a set. */
export function buildFieldMetaSql(fieldIds: string[]): SQL {
  const list = sql.join(fieldIds.map((f) => sql`${f}`), sql`, `)
  return sql`select field_id, table_id, base_id, name, type, options, is_primary from bo_at_fields where field_id in (${list})`
}

/** A table's primary field id — the linked table's display column. */
export function buildTablePrimaryFieldSql(tableId: string): SQL {
  return sql`select table_id, primary_field_id from bo_at_tables where table_id = ${tableId} limit 1`
}

/** A single cell's raw (JSON-encoded) value — the link id list / lookup source. */
export function buildCellValueSql(recordId: string, fieldId: string): SQL {
  return sql`select value from bo_at_record_field_data where record_id = ${recordId} and field_id = ${fieldId} limit 1`
}

/**
 * Hydrate a page of linked records: primary-field display value per record,
 * bounded to `pageIds` (linkedSetPredicate) and, when `q` is present and the
 * linked table has a primary field, filtered by the primary-field ILIKE search
 * (primaryFieldSearchPredicate). Deleted linked records are excluded here and
 * surface as `missing` via markMissing against the found set.
 */
export function buildLinkedPageSql(
  linkedTableId: string,
  primaryFieldId: string | null,
  pageIds: string[],
  q: string | null,
): SQL {
  const primaryJoin = primaryFieldId
    ? sql`left join bo_at_record_field_data rfd on rfd.table_id = ${linkedTableId} and rfd.field_id = ${primaryFieldId} and rfd.record_id = bo_at_records.record_id`
    : sql``
  const primarySelect = primaryFieldId ? sql`rfd.value` : sql`null`
  const searchClause =
    q && primaryFieldId
      ? sql` and ${primaryFieldSearchPredicate(linkedTableId, primaryFieldId, q)}`
      : sql``
  return sql`select bo_at_records.record_id as record_id, ${primarySelect} as primary_value, bo_at_records.status as status from bo_at_records ${primaryJoin} where bo_at_records.table_id = ${linkedTableId} and ${linkedSetPredicate(pageIds)} and bo_at_records.status <> 'deleted'${searchClause}`
}

/** The un-searched existence probe: which of `pageIds` are live (non-deleted)
 *  records — the found set for markMissing, so a search miss is never mistaken
 *  for a dangling id. */
export function buildFoundIdsSql(linkedTableId: string, pageIds: string[]): SQL {
  return sql`select bo_at_records.record_id as record_id from bo_at_records where bo_at_records.table_id = ${linkedTableId} and ${linkedSetPredicate(pageIds)} and bo_at_records.status <> 'deleted'`
}

/** (record_id, field_id, value) for a set of fields across a set of records —
 *  preview values, referenced-field values, looked-up values. */
export function buildFieldValuesSql(tableId: string, fieldIds: string[], recordIds: string[]): SQL {
  const fieldList = sql.join(fieldIds.map((f) => sql`${f}`), sql`, `)
  const recordList = sql.join(recordIds.map((r) => sql`${r}`), sql`, `)
  return sql`select record_id, field_id, value from bo_at_record_field_data where table_id = ${tableId} and field_id in (${fieldList}) and record_id in (${recordList})`
}

/** A deterministic handful of a table's active fields (primary excluded) to
 *  preview alongside the display value. Ordered by field_id so paging is stable. */
export function buildPreviewFieldIdsSql(tableId: string, excludeFieldId: string | null, limit: number): SQL {
  const exclude = excludeFieldId ? sql` and field_id <> ${excludeFieldId}` : sql``
  return sql`select field_id from bo_at_fields where table_id = ${tableId} and status = 'active'${exclude} order by field_id limit ${limit}`
}

/** Decode a JSON-encoded cell value back to its native JS value; raw text on a
 *  parse miss (mirrors record-read-io's decodeValue). */
export function decodeCellValue(v: string | null): unknown {
  if (v == null) return null
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

// ── Linked-record expansion (route 1) ────────────────────────────────────────

export interface LinkRow {
  recordId: string
  primaryValue?: unknown
  preview?: Record<string, unknown>
  missing?: true
}

export type LinkExpansion =
  | { status: 'field_not_found' }
  | { status: 'not_linkable' }
  | { status: 'ok'; links: LinkRow[]; nextCursor: string | null; total: number }

export interface ExpandLinkedArgs {
  recordId: string
  fieldId: string
  cursor: string | null
  limit: number
  q: string | null
}

function rowsOf<T>(res: unknown): T[] {
  return [...(res as Iterable<T>)]
}

export async function expandLinkedSet(tx: SpaceTx, args: ExpandLinkedArgs): Promise<LinkExpansion> {
  const [field] = rowsOf<{ type: string; options: unknown }>(
    await tx.execute(buildFieldMetaSql([args.fieldId])),
  )
  if (!field) return { status: 'field_not_found' }

  const prov = interpretProvenance({ type: field.type, options: field.options })
  if (prov.kind !== 'linked' || !prov.linkedTableId) return { status: 'not_linkable' }
  const linkedTableId = prov.linkedTableId

  const [cell] = rowsOf<{ value: string | null }>(
    await tx.execute(buildCellValueSql(args.recordId, args.fieldId)),
  )
  const ids = parseLinkIds(cell?.value ?? null)
  const total = ids.length
  const { pageIds, nextCursor } = pageLinkIds(ids, args.cursor, args.limit)
  if (pageIds.length === 0) return { status: 'ok', links: [], nextCursor, total }

  const [primaryRow] = rowsOf<{ primary_field_id: string | null }>(
    await tx.execute(buildTablePrimaryFieldSql(linkedTableId)),
  )
  const primaryFieldId = primaryRow?.primary_field_id ?? null

  const matched = rowsOf<{ record_id: string; primary_value: string | null }>(
    await tx.execute(buildLinkedPageSql(linkedTableId, primaryFieldId, pageIds, args.q)),
  )
  const matchedById = new Map(matched.map((r) => [r.record_id, r]))

  // Found set = live records among the page. When a search is active the matched
  // set is already filtered, so probe existence separately — otherwise a search
  // miss would masquerade as a dangling id.
  const foundIds = args.q
    ? new Set(
        rowsOf<{ record_id: string }>(
          await tx.execute(buildFoundIdsSql(linkedTableId, pageIds)),
        ).map((r) => r.record_id),
      )
    : new Set(matchedById.keys())
  const missingIds = new Set(markMissing(pageIds, foundIds).map((m) => m.recordId))

  // Preview values for the matched records only.
  const matchedIds = [...matchedById.keys()]
  const previewByRecord = new Map<string, Record<string, unknown>>()
  if (matchedIds.length) {
    const previewFieldIds = rowsOf<{ field_id: string }>(
      await tx.execute(buildPreviewFieldIdsSql(linkedTableId, primaryFieldId, PREVIEW_FIELD_LIMIT)),
    ).map((r) => r.field_id)
    if (previewFieldIds.length) {
      const values = rowsOf<{ record_id: string; field_id: string; value: string | null }>(
        await tx.execute(buildFieldValuesSql(linkedTableId, previewFieldIds, matchedIds)),
      )
      for (const v of values) {
        let rec = previewByRecord.get(v.record_id)
        if (!rec) {
          rec = {}
          previewByRecord.set(v.record_id, rec)
        }
        rec[v.field_id] = decodeCellValue(v.value)
      }
    }
  }

  // Assemble in link-list order: matches carry their value, dangling ids carry
  // `missing`, records filtered out by the search are simply omitted.
  const links: LinkRow[] = []
  for (const id of pageIds) {
    const hit = matchedById.get(id)
    if (hit) {
      links.push({ recordId: id, primaryValue: decodeCellValue(hit.primary_value), preview: previewByRecord.get(id) ?? {} })
    } else if (missingIds.has(id)) {
      links.push({ recordId: id, missing: true })
    }
  }

  return { status: 'ok', links, nextCursor, total }
}

// ── Cell provenance (route 2) ────────────────────────────────────────────────

export interface FormulaProvenance {
  kind: 'formula'
  expression: string | null
  referencedFields:
    | Array<{ fieldId: string; name: string | null; type: string | null; value: unknown }>
    | null
  reason?: string
}

export type ProvenanceSource =
  | { recordId: string; display: unknown; value: unknown }
  | { recordId: string; missing: true }

export interface DerivedProvenance {
  kind: 'lookup' | 'rollup'
  recordLinkFieldId: string | null
  fieldIdInLinkedTable: string | null
  sourceTableId: string | null
  aggregation?: string | null
  sources: ProvenanceSource[] | null
  nextCursor: string | null
  total: number
  reason?: string
}

export type ResolvedProvenance = FormulaProvenance | DerivedProvenance

export type ProvenanceResult =
  | { status: 'field_not_found' }
  | { status: 'ok'; provenance: ResolvedProvenance | null }

export interface ResolveProvenanceArgs {
  recordId: string
  fieldId: string
  cursor: string | null
  limit: number
}

export async function resolveProvenance(tx: SpaceTx, args: ResolveProvenanceArgs): Promise<ProvenanceResult> {
  const [field] = rowsOf<{ table_id: string; type: string; options: unknown }>(
    await tx.execute(buildFieldMetaSql([args.fieldId])),
  )
  if (!field) return { status: 'field_not_found' }

  const prov = interpretProvenance({ type: field.type, options: field.options })

  // A plain field or a direct link has no derivation to trace.
  if (prov.kind === 'none' || prov.kind === 'linked') return { status: 'ok', provenance: null }

  if (prov.kind === 'formula') {
    if (!prov.referencedFieldIds) {
      return {
        status: 'ok',
        provenance: { kind: 'formula', expression: prov.expression, referencedFields: null, reason: prov.reason },
      }
    }
    const refIds = prov.referencedFieldIds
    const meta = new Map(
      rowsOf<{ field_id: string; name: string | null; type: string | null }>(
        await tx.execute(buildFieldMetaSql(refIds)),
      ).map((r) => [r.field_id, r]),
    )
    const valueByField = new Map(
      rowsOf<{ field_id: string; value: string | null }>(
        await tx.execute(buildFieldValuesSql(field.table_id, refIds, [args.recordId])),
      ).map((r) => [r.field_id, r.value]),
    )
    const referencedFields = refIds.map((id) => ({
      fieldId: id,
      name: meta.get(id)?.name ?? null,
      type: meta.get(id)?.type ?? null,
      value: decodeCellValue(valueByField.get(id) ?? null),
    }))
    return { status: 'ok', provenance: { kind: 'formula', expression: prov.expression, referencedFields } }
  }

  // lookup | rollup — traverse the link field one level to its source records.
  const base: DerivedProvenance = {
    kind: prov.kind,
    recordLinkFieldId: prov.recordLinkFieldId,
    fieldIdInLinkedTable: prov.fieldIdInLinkedTable,
    sourceTableId: null,
    sources: null,
    nextCursor: null,
    total: 0,
    ...(prov.kind === 'rollup' ? { aggregation: prov.aggregation } : {}),
  }
  if (!prov.recordLinkFieldId || !prov.fieldIdInLinkedTable) {
    return { status: 'ok', provenance: { ...base, reason: 'link/source reference metadata not captured in field options' } }
  }

  const [linkField] = rowsOf<{ type: string; options: unknown }>(
    await tx.execute(buildFieldMetaSql([prov.recordLinkFieldId])),
  )
  const linkProv = linkField ? interpretProvenance({ type: linkField.type, options: linkField.options }) : null
  const linkedTableId = linkProv && linkProv.kind === 'linked' ? linkProv.linkedTableId : null

  const [cell] = rowsOf<{ value: string | null }>(
    await tx.execute(buildCellValueSql(args.recordId, prov.recordLinkFieldId)),
  )
  const sourceIds = parseLinkIds(cell?.value ?? null)
  const total = sourceIds.length
  const { pageIds, nextCursor } = pageLinkIds(sourceIds, args.cursor, args.limit)

  if (!linkedTableId) {
    // Link target not resolvable (legacy capture) — return the ids un-hydrated.
    const sources: ProvenanceSource[] = pageIds.map((recordId) => ({ recordId, display: null, value: null }))
    return {
      status: 'ok',
      provenance: { ...base, sourceTableId: null, sources, nextCursor, total, reason: 'linked table id not captured in link-field options' },
    }
  }

  if (pageIds.length === 0) {
    return { status: 'ok', provenance: { ...base, sourceTableId: linkedTableId, sources: [], nextCursor, total } }
  }

  const [primaryRow] = rowsOf<{ primary_field_id: string | null }>(
    await tx.execute(buildTablePrimaryFieldSql(linkedTableId)),
  )
  const primaryFieldId = primaryRow?.primary_field_id ?? null

  const fetchFieldIds = [...new Set([primaryFieldId, prov.fieldIdInLinkedTable].filter((x): x is string => !!x))]
  const cellByRecord = new Map<string, Record<string, string | null>>()
  if (fetchFieldIds.length) {
    for (const r of rowsOf<{ record_id: string; field_id: string; value: string | null }>(
      await tx.execute(buildFieldValuesSql(linkedTableId, fetchFieldIds, pageIds)),
    )) {
      let rec = cellByRecord.get(r.record_id)
      if (!rec) {
        rec = {}
        cellByRecord.set(r.record_id, rec)
      }
      rec[r.field_id] = r.value
    }
  }
  const foundIds = new Set(
    rowsOf<{ record_id: string }>(await tx.execute(buildFoundIdsSql(linkedTableId, pageIds))).map((r) => r.record_id),
  )

  const sources: ProvenanceSource[] = pageIds.map((recordId) => {
    if (!foundIds.has(recordId)) return { recordId, missing: true }
    const cells = cellByRecord.get(recordId)
    return {
      recordId,
      display: decodeCellValue(primaryFieldId ? cells?.[primaryFieldId] ?? null : null),
      value: decodeCellValue(cells?.[prov.fieldIdInLinkedTable!] ?? null),
    }
  })

  return { status: 'ok', provenance: { ...base, sourceTableId: linkedTableId, sources, nextCursor, total } }
}
