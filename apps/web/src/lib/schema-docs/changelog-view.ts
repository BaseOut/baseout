/**
 * Changelog tab view logic (web-schema-changelog) — pure helpers behind
 * views/schema/ChangelogTab.astro.
 *
 * The engine feed is deliberately lean (server-schema-changelog landed v0):
 * entries carry `kind: 'modified' | 'removed'` plus the raw `changeType` and
 * identifiers, NOT display names or rendered summaries. This module derives the
 * display taxonomy (renamed / retyped / config) from `changeType` and resolves
 * entity names from the SSR schema payload the page already holds.
 */
import type { ChangelogEntryView } from '../backup-engine'

export type ChangelogKindKey = 'added' | 'removed' | 'renamed' | 'retyped' | 'config'

export interface DerivedKind {
  key: ChangelogKindKey
  label: string
}

/** Map an entry's (kind, changeType) to the display taxonomy. */
export function deriveKind(entry: ChangelogEntryView): DerivedKind {
  if (entry.kind === 'removed') return { key: 'removed', label: 'Removed' }
  if ((entry.kind as string) === 'added') return { key: 'added', label: 'Added' }
  switch (entry.changeType) {
    case 'name':
      return { key: 'renamed', label: 'Renamed' }
    case 'type':
      return { key: 'retyped', label: 'Type changed' }
    case 'options':
    case 'description':
    case 'primary_field':
      return { key: 'config', label: 'Config' }
    default:
      return { key: 'config', label: 'Changed' }
  }
}

export interface NameIndexInput {
  bases: { baseId: string; name: string }[]
  tables: { tableId: string; baseId: string; name: string }[]
  fields: { fieldId: string; tableId: string; baseId: string; name: string }[]
  views: { viewId: string; tableId: string; baseId: string; name: string }[]
}

export interface NameIndex {
  bases: Map<string, string>
  tables: Map<string, string>
  fields: Map<string, string>
  views: Map<string, string>
}

export function buildNameIndex(schema: NameIndexInput): NameIndex {
  return {
    bases: new Map(schema.bases.map((b) => [b.baseId, b.name])),
    tables: new Map(schema.tables.map((t) => [t.tableId, t.name])),
    fields: new Map(schema.fields.map((f) => [f.fieldId, f.name])),
    views: new Map(schema.views.map((v) => [v.viewId, v.name])),
  }
}

export interface ResolvedEntry {
  entityLabel: string
  baseName: string
  tableName: string | null
}

/**
 * Resolve display names for an entry. Removal entries carry `entityName` from
 * the lifecycle row; modification entries resolve via the SSR index, falling
 * back to the raw id (e.g. an entity no longer in the current working set).
 */
export function resolveEntry(entry: ChangelogEntryView, index: NameIndex): ResolvedEntry {
  const byType: Record<ChangelogEntryView['entityType'], Map<string, string>> = {
    base: index.bases,
    table: index.tables,
    field: index.fields,
    view: index.views,
  }
  const entityLabel =
    entry.entityName ?? byType[entry.entityType]?.get(entry.entityId) ?? entry.entityId
  const baseName = index.bases.get(entry.baseId) ?? entry.baseId
  const tableName =
    entry.entityType === 'table' ? null : entry.tableId ? (index.tables.get(entry.tableId) ?? entry.tableId) : null
  return { entityLabel, baseName, tableName }
}

export interface DayGroup {
  label: string
  entries: ChangelogEntryView[]
}

/**
 * Group a date-descending feed into calendar-day buckets (local time),
 * preserving order. Null-dated entries collect under a trailing "Undated".
 */
export function groupByDay(entries: ChangelogEntryView[]): DayGroup[] {
  const groups: DayGroup[] = []
  const undated: ChangelogEntryView[] = []
  let currentKey: string | null = null
  for (const entry of entries) {
    if (!entry.at) {
      undated.push(entry)
      continue
    }
    const d = new Date(entry.at)
    const key = Number.isNaN(d.getTime()) ? entry.at : d.toDateString()
    if (key !== currentKey) {
      currentKey = key
      const label = Number.isNaN(d.getTime())
        ? entry.at
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      groups.push({ label, entries: [] })
    }
    groups[groups.length - 1].entries.push(entry)
  }
  if (undated.length > 0) groups.push({ label: 'Undated', entries: undated })
  return groups
}

export interface ChangelogFilter {
  /** Derived-kind key to keep, or null for all kinds. */
  kind: ChangelogKindKey | null
  includeRemoved: boolean
  term: string
}

export function filterEntries(
  entries: ChangelogEntryView[],
  filter: ChangelogFilter,
  index: NameIndex,
): ChangelogEntryView[] {
  const term = filter.term.trim().toLowerCase()
  return entries.filter((entry) => {
    const kind = deriveKind(entry)
    if (!filter.includeRemoved && kind.key === 'removed') return false
    if (filter.kind && kind.key !== filter.kind) return false
    if (term === '') return true
    const r = resolveEntry(entry, index)
    const haystack = [
      r.entityLabel,
      r.baseName,
      r.tableName ?? '',
      kind.label,
      formatValue(entry.before),
      formatValue(entry.after),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(term)
  })
}

/** Display string for a before/after value (raw engine JSON — string | object | null). */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
