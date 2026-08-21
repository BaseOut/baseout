/**
 * data-browse/map — pure mappers from the engine's Data read shapes
 * (`engine-shapes.ts` / later `backup-engine.ts`: GetSchemaResult / DataRecordRow /
 * MediaAssetView) into the Data page component prop shapes
 * (`components/data/dataTypes.ts`: DataBase / DataTable / DataRecord /
 * DataChangeEntry / MediaAsset).
 *
 * These are the §3.4 non-trivial logic of web-data-page's Stage-3 wiring; the
 * SSR loader in `pages/data.astro` calls the engine and feeds the results
 * through here. Kept pure + framework-free so they unit-test without Miniflare.
 *
 * HONESTY NOTES (documented gaps, never faked):
 *  - Changelog rows carry a recordId but no primary-field display string, so
 *    `primary` falls back to the recordId; resolving the display name is the
 *    client-paginated follow-up (server-data-browse record lookup).
 *  - MediaAssetView carries a thumbnail STORAGE key, not a URL, so `thumbUrl`
 *    is left undefined (the component renders its designed glyph state).
 */

import type { GetSchemaResult } from '../backup-engine'
import type {
  DataRecordRow,
  DataChangelogRunRollup,
  DataChangelogChangeRow,
  DataCommentRow,
  MediaAssetView,
} from './engine-shapes'
import type {
  DataBase,
  DataTable,
  DataField,
  DataRecord,
  DataCell,
  DataChangeEntry,
  DataComment,
  DataCommentAuthor,
  DataCommentMention,
  MediaAsset,
  MediaKind,
  AssetStorage,
} from '../../components/data/dataTypes'

type SchemaOk = Extract<GetSchemaResult, { ok: true }>

/** Only entities that are still present in the latest capture (not lifecycle-removed). */
function isActive(status: string, removedAt: string | null): boolean {
  return removedAt === null && status !== 'removed'
}

export interface MappedSchema {
  bases: DataBase[]
  tables: DataTable[]
  /** tableId → the primary field id (drives DataRecord.primary), when known. */
  primaryByTable: Record<string, string | undefined>
}

/** schema (bases/tables/fields) → the Data page's base + table structure. */
export function mapSchemaToData(schema: SchemaOk): MappedSchema {
  const bases: DataBase[] = schema.bases
    .filter((b) => isActive(b.status, b.removedAt))
    .map((b) => ({ id: b.baseId, name: b.name }))

  const primaryByTable: Record<string, string | undefined> = {}
  const fieldsByTable = new Map<string, DataField[]>()
  for (const f of schema.fields) {
    if (!isActive(f.status, f.removedAt)) continue
    if (f.isPrimary) primaryByTable[f.tableId] = f.fieldId
    const field: DataField = { id: f.fieldId, name: f.name, type: f.type }
    if (f.linkedTableId) field.linkedTableId = f.linkedTableId
    if (f.formula) field.expression = f.formula
    const list = fieldsByTable.get(f.tableId) ?? []
    list.push(field)
    fieldsByTable.set(f.tableId, list)
  }

  const tables: DataTable[] = schema.tables
    .filter((t) => isActive(t.status, t.removedAt))
    .map((t) => ({
      id: t.tableId,
      baseId: t.baseId,
      name: t.name,
      fields: fieldsByTable.get(t.tableId) ?? [],
      approxRecordCount: t.recordCount ?? 0,
    }))

  return { bases, tables, primaryByTable }
}

/** A captured cell value → a read-only display string (objects/arrays → JSON). */
export function cellRaw(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  try {
    return JSON.stringify(val)
  } catch {
    return String(val)
  }
}

/** One table's record page → DataRecord[] (cells keyed by field id). */
export function mapRecords(
  rows: DataRecordRow[],
  tableId: string,
  primaryFieldId: string | undefined,
): DataRecord[] {
  return rows.map((r) => {
    const cells: Record<string, DataCell> = {}
    for (const [fid, val] of Object.entries(r.fields ?? {})) {
      const raw = cellRaw(val)
      cells[fid] = raw === '' ? { raw, empty: true } : { raw }
    }
    const primary =
      primaryFieldId && r.fields && r.fields[primaryFieldId] !== undefined
        ? cellRaw(r.fields[primaryFieldId])
        : r.recordId
    return { id: r.recordId, tableId, primary: primary || r.recordId, cells }
  })
}

/** Preferred shared name for SSR + client cursor fetches (alias of `mapRecords`). */
export const mapRecordRows = mapRecords

/** Rollup runs → per-run TRUE totals (created/updated/deleted). */
export function mapRunTotals(
  runs: DataChangelogRunRollup[],
): Record<string, { created: number; updated: number; deleted: number }> {
  const out: Record<string, { created: number; updated: number; deleted: number }> = {}
  for (const r of runs) {
    out[r.runId] = { created: r.createdCount, updated: r.updatedCount, deleted: r.deletedCount }
  }
  return out
}

/** Per-run changelog rows → DataChangeEntry sample (primary = recordId, see honesty note). */
export function mapChangelogRows(
  rows: DataChangelogChangeRow[],
  runId: string,
  runAt: string,
): DataChangeEntry[] {
  return rows.map((r) => {
    const entry: DataChangeEntry = {
      id: `${runId}:${r.changeType}:${r.recordId}`,
      recordId: r.recordId,
      primary: r.recordId,
      tableId: r.tableId ?? '',
      runId,
      at: r.modifiedTime ?? r.createdTime ?? runAt,
      type: r.changeType,
    }
    if (r.changedFieldIds) entry.fieldCount = r.changedFieldIds.length
    return entry
  })
}

const MENTION_TYPES: ReadonlySet<string> = new Set(['user', 'userGroup', 'appAgent'])

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Shape the engine's verbatim `author` jsonb into DataCommentAuthor (id always
 *  a string; a withheld/malformed payload degrades to a nameless author — the
 *  row then reads "Author not captured" via commentText, never a raw id). */
function toAuthor(raw: unknown): DataCommentAuthor {
  if (!isObj(raw)) return { id: '' }
  const author: DataCommentAuthor = { id: typeof raw.id === 'string' ? raw.id : '' }
  if (typeof raw.email === 'string') author.email = raw.email
  if (typeof raw.name === 'string') author.name = raw.name
  return author
}

/** Shape Airtable's `mentioned` map into DataCommentMention values, dropping any
 *  malformed entry. Undefined when nobody is mentioned — resolveMentions then
 *  strips any leftover `@[id]` token rather than leaking a database key. */
function toMentioned(raw: Record<string, unknown> | null): Record<string, DataCommentMention> | undefined {
  if (!raw) return undefined
  const out: Record<string, DataCommentMention> = {}
  for (const [key, val] of Object.entries(raw)) {
    if (!isObj(val)) continue
    const id = typeof val.id === 'string' ? val.id : key
    const type = typeof val.type === 'string' && MENTION_TYPES.has(val.type) ? (val.type as DataCommentMention['type']) : 'user'
    const m: DataCommentMention = { id, type }
    if (typeof val.displayName === 'string') m.displayName = val.displayName
    if (typeof val.email === 'string') m.email = val.email
    out[key] = m
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Comment rows → DataComment[] (Data ▸ Comments, server-comments-read).
 *
 * HONESTY NOTE: attachments + reactions are NOT surfaced in this first read
 * slice — comment attachments live in the engine's separate
 * bo_at_comment_attachments table (a follow-up read), and reactions are carried
 * by the type but never rendered. Both are left undefined; the panel degrades to
 * a 0-file count, which is honest for now. `createdAt` / `lastSeenAt` are
 * required non-null strings on DataComment, so a null captured timestamp falls
 * back to the best available stamp rather than emitting an empty sort key.
 */
export function mapComments(rows: DataCommentRow[]): DataComment[] {
  return rows.map((r) => {
    const createdAt = r.createdTime ?? r.lastSeenAt ?? ''
    const comment: DataComment = {
      id: r.commentId,
      recordId: r.recordId,
      tableId: r.tableId,
      author: toAuthor(r.author),
      text: r.text ?? '',
      createdAt,
      lastUpdatedAt: r.lastUpdatedTime,
      lastSeenAt: r.lastSeenAt ?? createdAt,
    }
    if (r.parentCommentId) comment.parentCommentId = r.parentCommentId
    const mentioned = toMentioned(r.mentioned)
    if (mentioned) comment.mentioned = mentioned
    return comment
  })
}

const MEDIA_KINDS: ReadonlySet<string> = new Set(['image', 'video', 'audio', 'document', 'other'])
const STORAGE_PROVIDERS: ReadonlySet<string> = new Set([
  'google_drive',
  'dropbox',
  'box',
  'onedrive',
  's3',
])

function toMediaKind(contentClass: string): MediaKind {
  return (MEDIA_KINDS.has(contentClass) ? contentClass : 'other') as MediaKind
}

function toStorage(view: MediaAssetView): AssetStorage {
  const storage: AssetStorage = { baseout: view.storageKind === 'r2_managed' }
  if (view.storageProvider && STORAGE_PROVIDERS.has(view.storageProvider)) {
    storage.provider = view.storageProvider as AssetStorage['provider']
  }
  return storage
}

/** Media list items → MediaAsset[] (always a FIELD source — refs carry a field id). */
export function mapMediaAssets(items: MediaAssetView[]): MediaAsset[] {
  return items.map((view) => {
    const ref = view.refs[0]
    const base: Omit<MediaAsset, 'sourceKind' | 'source'> = {
      id: view.id,
      kind: toMediaKind(view.contentClass),
      storage: toStorage(view),
      capturedAt: view.firstSeenAt ?? '',
      lastSeenAt: view.lastSeenAt ?? view.firstSeenAt ?? '',
    }
    if (ref?.filename) base.filename = ref.filename
    if (view.contentType) base.type = view.contentType
    if (view.sizeBytes != null) base.size = view.sizeBytes
    if (view.checksum) base.checksum = view.checksum
    return {
      ...base,
      sourceKind: 'field',
      source: {
        baseId: ref?.baseId ?? '',
        tableId: ref?.tableId ?? '',
        fieldId: ref?.fieldId ?? '',
        recordId: ref?.recordId ?? '',
      },
    }
  })
}
