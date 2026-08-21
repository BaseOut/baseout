/**
 * Map engine ChangelogEntryView → tip SchemaChangelog ChangelogEntry.
 * Keeps live changelog proxy lean; presentation lives in the tip UI.
 */
import type { ChangelogEntryView } from '../backup-engine'
import {
  buildNameIndex,
  deriveKind,
  formatValue,
  resolveEntry,
  type NameIndexInput,
} from './changelog-view'

export type TipChangelogType = 'added' | 'removed' | 'renamed' | 'typed' | 'config'

export interface TipChangelogEntry {
  id: string
  at: string
  base: string
  table?: string
  field?: string
  entityId?: string
  fieldType?: string
  entityKind?: 'automation' | 'interface' | 'page' | 'view'
  entityName?: string
  type: TipChangelogType
  summary: string
  before?: string
  after?: string
  aiSummary?: string
  warning?: string
}

function tipType(key: string): TipChangelogType {
  if (key === 'retyped') return 'typed'
  if (key === 'added' || key === 'removed' || key === 'renamed' || key === 'config') return key
  return 'config'
}

function summaryFor(
  type: TipChangelogType,
  label: string,
  entityLabel: string,
  before: string,
  after: string,
): string {
  switch (type) {
    case 'added':
      return `Added ${entityLabel}`
    case 'removed':
      return `Removed ${entityLabel}`
    case 'renamed':
      return `Renamed ${entityLabel}: ${before} → ${after}`
    case 'typed':
      return `Type changed on ${entityLabel}: ${before} → ${after}`
    case 'config':
      return `${label} on ${entityLabel}${before !== '—' || after !== '—' ? `: ${before} → ${after}` : ''}`
  }
}

/** Adapt one engine entry (optionally with a NameIndex already built). */
export function adaptChangelogEntry(
  entry: ChangelogEntryView,
  schema: NameIndexInput,
  index = buildNameIndex(schema),
): TipChangelogEntry {
  const kind = deriveKind(entry)
  const type = tipType(kind.key)
  const resolved = resolveEntry(entry, index)
  const before = formatValue(entry.before)
  const after = formatValue(entry.after)
  const at = entry.at ?? ''
  const id = [entry.runId ?? 'run', entry.entityId, at, entry.changeType ?? entry.kind].join(':')

  const tip: TipChangelogEntry = {
    id,
    at,
    base: resolved.baseName,
    type,
    summary: summaryFor(type, kind.label, resolved.entityLabel, before, after),
    entityId: entry.entityId,
  }
  if (resolved.tableName) tip.table = resolved.tableName
  if (entry.entityType === 'field') tip.field = resolved.entityLabel
  if (entry.entityType === 'view') {
    tip.entityKind = 'view'
    tip.entityName = resolved.entityLabel
  }
  if (before !== '—') tip.before = before
  if (after !== '—') tip.after = after
  if (entry.breaksData) tip.warning = 'This change may have invalidated existing data.'
  return tip
}

export function adaptChangelogEntries(
  entries: ChangelogEntryView[],
  schema: NameIndexInput,
): TipChangelogEntry[] {
  const index = buildNameIndex(schema)
  return entries.map((e) => adaptChangelogEntry(e, schema, index))
}
