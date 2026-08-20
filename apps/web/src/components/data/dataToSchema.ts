/**
 * dataToSchema — adapters that let the Data page REUSE Schema Docs + Chat surfaces
 * (web-data-docs-chat). apps/web keeps working `views/schema/{DocsTab,ChatTab}`; this
 * module projects the Data page's bases/tables/fields/views into the entity shapes those
 * tabs already consume. Records are filtered for orphan drops only — SchemaDocTargetType
 * has no `record` variant, so they never become Docs tags.
 *
 * Promoted from ui-only `dataToSchema.ts` and retargeted at apps/web's DocsTabEntity /
 * ChatTab healthBases (fork SchemaCanvas / schemaEntities are NOT promoted).
 */
import type { DocsTabEntity } from '../islands/DocsTab'
import type { DataBase, DataTable, DataRecord, SavedView } from './dataTypes'

/** Drop records whose tableId is missing from the Data table index (defensive; never throw). */
export function filterRecordsWithParentTable(
  records: DataRecord[],
  tables: DataTable[],
): DataRecord[] {
  const tableIds = new Set(tables.map((t) => t.id))
  return records.filter((r) => tableIds.has(r.tableId))
}

/**
 * Project Data bases/tables/fields (+ optional saved Browse views) into the Docs tab
 * entity picker shape SchemaView already builds from getSchema.
 */
export function buildDataDocsEntities(
  bases: DataBase[],
  tables: DataTable[],
  opts: { views?: SavedView[]; records?: DataRecord[] } = {},
): DocsTabEntity[] {
  // Orphan records must not throw — filter and ignore (no Docs target type for records).
  if (opts.records) filterRecordsWithParentTable(opts.records, tables)

  const entities: DocsTabEntity[] = [
    ...bases.map((b) => ({ type: 'base' as const, id: b.id, label: b.name })),
    ...tables.map((t) => ({ type: 'table' as const, id: t.id, label: t.name })),
    ...tables.flatMap((t) =>
      t.fields.map((f) => ({ type: 'field' as const, id: f.id, label: f.name })),
    ),
  ]
  if (opts.views?.length) {
    for (const v of opts.views) {
      entities.push({ type: 'view', id: v.id, label: v.name })
    }
  }
  return entities
}

/** Chat context picker — same `{ baseId, name }` rows SchemaView feeds ChatTab. */
export function dataBasesToHealthBases(
  bases: DataBase[],
): { baseId: string; name: string }[] {
  return bases.map((b) => ({ baseId: b.id, name: b.name }))
}
