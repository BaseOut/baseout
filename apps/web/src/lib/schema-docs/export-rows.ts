/**
 * Pure CSV row builders for the Schema tab exports (web-schema-export).
 *
 * The ExportControl pattern dispatches a cancelable `schema:export` event; the
 * tabs whose data is client-available (Browse's entity index, Changelog's
 * fetched entries) build their rows here and download via lib/csv's formatCsv.
 * Kept pure — DOM scope resolution and the Blob download stay in the tab
 * scripts / lib/ui.ts.
 */
import type { ChangelogEntryView } from '../backup-engine'
import type { EntityPanelInfo } from './entity-index'
import { deriveKind, formatValue, resolveEntry, type NameIndex } from './changelog-view'

export const ENTITY_EXPORT_HEADER = ['base', 'table', 'field', 'type', 'description', 'status'] as const

/** One Browse-tab entity → one CSV row. Column occupancy follows the entity's kind. */
export function entityRow(info: EntityPanelInfo): string[] {
  const base = info.kind === 'base' ? info.name : info.baseName
  const table = info.kind === 'table' ? info.name : (info.tableName ?? '')
  const field = info.kind === 'field' || info.kind === 'view' ? info.name : ''
  const type = info.kind === 'field' ? (info.fieldType ?? 'field') : info.kind
  const description = info.airtableDescription ?? info.aiDescription ?? info.internalDescription ?? ''
  return [base, table, field, type, description, info.status]
}

export const CHANGELOG_EXPORT_HEADER = ['at', 'base', 'table', 'field', 'changeType', 'summary'] as const

/** One changelog entry → one CSV row, names resolved via the SSR NameIndex. */
export function changelogRow(entry: ChangelogEntryView, index: NameIndex): string[] {
  const kind = deriveKind(entry)
  const r = resolveEntry(entry, index)
  const table = entry.entityType === 'table' ? r.entityLabel : (r.tableName ?? '')
  const field = entry.entityType === 'field' || entry.entityType === 'view' ? r.entityLabel : ''
  const delta =
    entry.kind === 'modified'
      ? `${formatValue(entry.before)} → ${formatValue(entry.after)}`
      : `${entry.entityType} removed`
  const summary = entry.breaksData ? `${delta} (may break data)` : delta
  return [entry.at ?? '', r.baseName, table, field, kind.label, summary]
}
