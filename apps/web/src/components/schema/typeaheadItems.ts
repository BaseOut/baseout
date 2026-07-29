/**
 * The row shape `EntitySearch.astro` renders, and the Schema adapter that
 * produces it.
 *
 * EntitySearch used to be welded to `SchemaEntity`: its client script computed
 * the icon, the parent path and the match haystack from schema-specific fields,
 * which meant any OTHER surface wanting "one field, search everything, group the
 * results" had no way in except a second hand-rolled typeahead. The component
 * now takes pre-built `TypeaheadItem`s, so every host owns its own naming and
 * the dropdown / keyboard / footer live in exactly one place.
 *
 * These helpers run in the Astro FRONTMATTER (server side), which is why the
 * icons are plain HTML strings: the client script only ever inserts them.
 */
import { AIRTABLE_FIELD_ICONS, airtableIconKey } from './airtableFieldIcons';
import type { SchemaEntity } from './schemaEntities';

export interface TypeaheadItem {
  /** Opaque to the component — it is handed straight back on the pick event. */
  id: string;
  /** Must be one of the kinds in the host's `groups` list, or the row is dropped. */
  kind: string;
  name: string;
  /** Muted second line: the parent path, or any short "where is this" context. */
  path?: string;
  /** Pre-rendered icon markup (iconify span or inline svg). */
  icon?: string;
  /** Optional trailing status dot: 'green' | 'amber' | 'red'. Omit for no dot. */
  health?: string;
  /** Lowercased substring haystack. Falls back to the name when absent. */
  hay?: string;
  /** Compared against `root.dataset.esScopeBase` when a host narrows the index. */
  scopeKey?: string;
}

/** Kind → heading label. Order here IS the heading order AND the arrow-key order. */
export type TypeaheadGroups = Array<[string, string]>;

export const SCHEMA_TYPEAHEAD_GROUPS: TypeaheadGroups = [
  ['base', 'Bases'],
  ['table', 'Tables'],
  ['field', 'Fields'],
  ['view', 'Views'],
];

function fieldIcon(type?: string): string {
  const k = type ? airtableIconKey(type) : null;
  return k ? `<svg viewBox="0 0 16 16">${AIRTABLE_FIELD_ICONS[k]}</svg>` : '<span class="iconify lucide--circle size-3.5"></span>';
}

function entityIcon(e: SchemaEntity): string {
  if (e.kind === 'base') return '<span class="iconify lucide--database concept-ic-base"></span>';
  if (e.kind === 'table') return '<span class="iconify lucide--table-2"></span>';
  if (e.kind === 'view') return '<span class="iconify lucide--eye concept-ic-view"></span>';
  return fieldIcon(e.fieldType);
}

// A view lives under a table, so it shows the same Base ▸ Table path a field does.
function entityPath(e: SchemaEntity): string {
  if (e.kind === 'field' || e.kind === 'view') return `${e.baseName} ▸ ${e.tableName}`;
  if (e.kind === 'table') return e.baseName;
  return 'Base';
}

export function entityToTypeaheadItem(e: SchemaEntity): TypeaheadItem {
  return {
    id: e.id,
    kind: e.kind,
    name: e.name,
    path: entityPath(e),
    icon: entityIcon(e),
    health: e.health,
    hay: `${e.name} ${e.tableName || ''} ${e.baseName}`.toLowerCase(),
    scopeKey: e.kind === 'base' ? e.name : e.baseName,
  };
}
