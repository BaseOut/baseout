// I/O layer for the single-record detail route (server-data-browse Task 3.2).
// Fetches one bo_at_records row plus its current field values and attachment
// metadata, keyed by the globally-unique record_id (the Space-wide PK — so the
// lookup needs no table_id). The pure SQL builders are rendered-SQL unit-tested
// in data-record-history-io.test.ts; live-PG behavior (real rows) is the
// deferred integration smoke (Task 5.1).
//
// `bo_at_record_field_data.value` is JSON-encoded text — decoded back to the
// native JS value on the way out (matching record-read-io.ts).

import { sql, type SQL } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'

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

export interface RecordAttachment {
  compositeId: string
  fieldId: string
  filename: string | null
  sizeBytes: number | null
  mimeType: string | null
  uploadStatus: string
  storageKey: string
}

export interface RecordDetail {
  recordId: string
  tableId: string
  baseId: string
  createdTime: string | null
  modifiedTime: string | null
  status: string
  fields: Record<string, unknown>
  attachments: RecordAttachment[]
}

export function recordRowQuery(recordId: string): SQL {
  return sql`
    select record_id, table_id, base_id, created_time, modified_time, status
    from bo_at_records
    where record_id = ${recordId}
    limit 1
  `
}

export function recordFieldsQuery(recordId: string): SQL {
  return sql`
    select field_id, value
    from bo_at_record_field_data
    where record_id = ${recordId}
  `
}

export function recordAttachmentsQuery(recordId: string): SQL {
  return sql`
    select composite_id, field_id, filename, size_bytes, mime_type, upload_status, storage_key
    from bo_at_attachments
    where record_id = ${recordId}
  `
}

/**
 * The full detail for one record: its lifecycle stamps, every populated field
 * value (JSON-decoded), and its attachment metadata. `null` when no
 * bo_at_records row exists (→ 404 record_not_found at the route).
 */
export async function fetchRecordDetail(tx: SpaceTx, recordId: string): Promise<RecordDetail | null> {
  const recRows = (await tx.execute(recordRowQuery(recordId))) as unknown as Iterable<{
    record_id: string
    table_id: string
    base_id: string
    created_time: unknown
    modified_time: unknown
    status: string
  }>
  const rec = [...recRows][0]
  if (!rec) return null

  const fieldRows = (await tx.execute(recordFieldsQuery(recordId))) as unknown as Iterable<{
    field_id: string
    value: string | null
  }>
  const fields: Record<string, unknown> = {}
  for (const r of fieldRows) fields[r.field_id] = decodeValue(r.value)

  const attRows = (await tx.execute(recordAttachmentsQuery(recordId))) as unknown as Iterable<{
    composite_id: string
    field_id: string
    filename: string | null
    size_bytes: unknown
    mime_type: string | null
    upload_status: string
    storage_key: string
  }>
  const attachments: RecordAttachment[] = [...attRows].map((a) => ({
    compositeId: a.composite_id,
    fieldId: a.field_id,
    filename: a.filename,
    sizeBytes: a.size_bytes == null ? null : Number(a.size_bytes),
    mimeType: a.mime_type,
    uploadStatus: a.upload_status,
    storageKey: a.storage_key,
  }))

  return {
    recordId: rec.record_id,
    tableId: rec.table_id,
    baseId: rec.base_id,
    createdTime: tsIso(rec.created_time),
    modifiedTime: tsIso(rec.modified_time),
    status: rec.status,
    fields,
    attachments,
  }
}
