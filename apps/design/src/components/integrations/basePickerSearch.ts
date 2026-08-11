/**
 * Rows for the base picker's typeahead (`schema/EntitySearch.astro`).
 *
 * The picker's search used to sit beside a scope `<select>` — "in Bases" /
 * "in Workspaces" — which made the user decide WHERE to look before they had
 * typed. That select is deleted. One field now searches both, and this module
 * builds the two kinds of row it can return.
 *
 * It lives in a `.ts` sibling rather than in `BaseSelectionTable.astro`'s
 * frontmatter on purpose: that frontmatter is already long, and heavy typing +
 * string building in Astro frontmatter is what has broken the esbuild build
 * here before.
 */
import { AIRTABLE_GLYPH } from '../schema/airtableGlyph';
import type { TypeaheadGroups, TypeaheadItem } from '../schema/typeaheadItems';

/** WORKSPACES first, then BASES — heading order AND arrow-key order. */
export const BASE_PICKER_TYPEAHEAD_GROUPS: TypeaheadGroups = [
  ['workspace', 'Workspaces'],
  ['base', 'Bases'],
];

/**
 * Structural subset of the picker's own `PickerGroup`. Kept minimal so the
 * builder never has to know about enrollment, aliases or placeholder numbering.
 */
export interface BasePickerSearchGroup {
  id: string;
  /** Display label already resolved by the picker (real name, "Workspace N", "No workspace"…). */
  name: string;
  /** Only a REAL workspace becomes a searchable workspace row. */
  isReal: boolean;
  rows: Array<{ b: { id: string; name: string } }>;
}

/** `ws:` / `base:` prefixes: the pick event carries one id space for two kinds. */
export const WS_PICK_PREFIX = 'ws:';
export const BASE_PICK_PREFIX = 'base:';

const BASE_ICON = '<span class="iconify lucide--database concept-ic-base"></span>';
// Monochrome Airtable mark (brand-logo exception) — the same glyph the group
// headers and the base-filter dropdowns use, so a workspace reads as the same
// object wherever it appears.
const WS_ICON = AIRTABLE_GLYPH;

export function buildBasePickerItems(groups: BasePickerSearchGroup[]): TypeaheadItem[] {
  const items: TypeaheadItem[] = [];
  for (const g of groups) {
    if (g.isReal) {
      items.push({
        id: `${WS_PICK_PREFIX}${g.id}`,
        kind: 'workspace',
        name: g.name,
        // A workspace's useful context is its size — how much picking it opens up.
        path: `${g.rows.length} base${g.rows.length === 1 ? '' : 's'}`,
        icon: WS_ICON,
        hay: g.name.toLowerCase(),
      });
    }
    for (const { b } of g.rows) {
      items.push({
        id: `${BASE_PICK_PREFIX}${b.id}`,
        kind: 'base',
        name: b.name,
        // A base's context is the workspace it sits in — which is also what
        // EXPLAINS a hit on a workspace term, right there in the row.
        path: g.name,
        icon: BASE_ICON,
        hay: `${b.name} ${g.name}`.toLowerCase(),
      });
    }
  }
  return items;
}
