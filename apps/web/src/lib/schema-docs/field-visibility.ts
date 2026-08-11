// Pure selection-model logic behind the reusable Fields visibility filter
// (openspec/changes/web-field-visibility-filter). No DOM / React imports, so it
// is shared by the vanilla Browse consumer now and a future Visualize/Chat
// React island later — the reusable part is the model, not the markup.
//
// Visibility is represented as a Set<fieldId> of *visible* fields. Group
// (table/base/global) tri-state is derived from that set.

export type TriState = 'checked' | 'unchecked' | 'indeterminate'

export interface FvBase {
  baseId: string
  name: string
}
export interface FvTable {
  tableId: string
  baseId: string
  name: string
}
export interface FvField {
  fieldId: string
  tableId: string
  baseId: string
  name: string
  type: string
}
export interface FvSchema {
  bases: FvBase[]
  tables: FvTable[]
  fields: FvField[]
}

/** Field ids belonging to a table. */
export function fieldIdsOfTable(schema: FvSchema, tableId: string): string[] {
  return schema.fields.filter((f) => f.tableId === tableId).map((f) => f.fieldId)
}

/** Field ids belonging to a base (across all its tables). */
export function fieldIdsOfBase(schema: FvSchema, baseId: string): string[] {
  return schema.fields.filter((f) => f.baseId === baseId).map((f) => f.fieldId)
}

/** How many of `fieldIds` are currently visible. */
export function visibleCount(fieldIds: string[], visible: ReadonlySet<string>): number {
  return fieldIds.reduce((n, id) => (visible.has(id) ? n + 1 : n), 0)
}

/**
 * Tri-state for a group of fields: `checked` when all visible, `unchecked` when
 * none (or the group is empty), `indeterminate` when partial.
 */
export function groupState(fieldIds: string[], visible: ReadonlySet<string>): TriState {
  if (fieldIds.length === 0) return 'unchecked'
  const n = visibleCount(fieldIds, visible)
  if (n === 0) return 'unchecked'
  if (n === fieldIds.length) return 'checked'
  return 'indeterminate'
}

/**
 * Return a NEW visible-set with `fieldIds` shown (`show=true`) or hidden
 * (`show=false`). The input set is not mutated.
 */
export function setFieldsVisible(
  visible: ReadonlySet<string>,
  fieldIds: string[],
  show: boolean,
): Set<string> {
  const next = new Set(visible)
  for (const id of fieldIds) {
    if (show) next.add(id)
    else next.delete(id)
  }
  return next
}

/** The trigger label, e.g. "Fields: 24 of 180". */
export function triggerLabel(visibleTotal: number, total: number): string {
  return `Fields: ${visibleTotal} of ${total}`
}

export interface QueryMatch {
  baseIds: Set<string>
  tableIds: Set<string>
  fieldIds: Set<string>
}

/**
 * Which entities the menu should show for a search `query`. An empty query
 * shows everything. Otherwise a match on any entity reveals its whole subtree
 * and its ancestors (so a table match shows its fields + base; a field match
 * shows its table + base). Case-insensitive substring match on names.
 */
export function matchesQuery(schema: FvSchema, query: string): QueryMatch {
  const baseIds = new Set<string>()
  const tableIds = new Set<string>()
  const fieldIds = new Set<string>()

  const q = query.trim().toLowerCase()
  if (q === '') {
    schema.bases.forEach((b) => baseIds.add(b.baseId))
    schema.tables.forEach((t) => tableIds.add(t.tableId))
    schema.fields.forEach((f) => fieldIds.add(f.fieldId))
    return { baseIds, tableIds, fieldIds }
  }

  const hit = (name: string) => name.toLowerCase().includes(q)

  // A matched base reveals its whole subtree.
  for (const b of schema.bases) {
    if (hit(b.name)) {
      baseIds.add(b.baseId)
      schema.tables.filter((t) => t.baseId === b.baseId).forEach((t) => tableIds.add(t.tableId))
      schema.fields.filter((f) => f.baseId === b.baseId).forEach((f) => fieldIds.add(f.fieldId))
    }
  }
  // A matched table reveals its base and its fields.
  for (const t of schema.tables) {
    if (hit(t.name)) {
      tableIds.add(t.tableId)
      baseIds.add(t.baseId)
      schema.fields.filter((f) => f.tableId === t.tableId).forEach((f) => fieldIds.add(f.fieldId))
    }
  }
  // A matched field reveals its ancestors.
  for (const f of schema.fields) {
    if (hit(f.name)) {
      fieldIds.add(f.fieldId)
      tableIds.add(f.tableId)
      baseIds.add(f.baseId)
    }
  }

  return { baseIds, tableIds, fieldIds }
}
