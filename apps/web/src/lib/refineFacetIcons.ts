/**
 * refineFacetIcons — the ONE mapping from a refinement control to its Lucide glyph (and, where the
 * control's own `aria-label` is wrong for a list row, its short name).
 *
 * Why a map and not a prop at each call site: the folded Filter drill is a LIST, and a list is
 * scanned, not read (Oleh 2026-08-05). Every row therefore needs a glyph — and four call sites each
 * spelling their own icon name is how five copies of `entityIcon` happened before
 * (`components/schema/entityIcon.ts` is the entity-kind equivalent of this file; these facets are
 * not entities, so they do not belong in it).
 *
 * Keying, in order: an explicit `data-tbf-key` on the control · its `data-facet` name · its
 * `data-dr` name. Names in this app are `<surface><concept>` (`mdbase`, `cmtable`, `dcdate`), so a
 * concept that means the same thing on every surface is listed ONCE under its concept and the
 * surface prefix is stripped before the lookup. Only a facet whose meaning is surface-specific
 * (Attachments' `Source`, Comments' `Status`) earns a full-name entry.
 *
 * Icon names are written as literals so Tailwind's `@source "../**\/*.ts"` scan finds them — a
 * name built by concatenation would not be in the compiled CSS at runtime.
 */

import { entityIconClass } from '../components/schema/entityIcon'

/** Full facet names, for concepts that only exist on one surface. */
const BY_NAME: Record<string, string> = {
  // Records ▸ the typed condition builder and the field show/hide picker.
  filter: 'lucide--list-filter',
  fields: 'lucide--tag',
  dgcomments: 'lucide--message-square',
  // Attachments.
  mdkind: 'lucide--shapes',
  mdsource: 'lucide--link',
  mdstore: 'lucide--hard-drive',
  mdsize: 'lucide--scale',
  // Comments.
  cmauthor: 'lucide--user',
  cmstatus: 'lucide--flag',
  // Changelog.
  dctype: 'lucide--pencil-line',
  // Visualize — the canvas facets. `vztype` is the FIELD-type facet, `vzreltype` the relationship
  // kind, `vzappkind` the app-layer node kind; none of the three means the same thing anywhere else.
  vztype: 'lucide--type',
  vzrel: 'lucide--waypoints',
  vzreltype: 'lucide--git-branch',
  vzappkind: 'lucide--boxes',
};

/** Concepts that mean the same thing on every surface — the prefix is stripped before lookup. */
const BY_CONCEPT: Record<string, string> = {
  base: entityIconClass('base'),
  table: entityIconClass('table'),
  field: entityIconClass('field'),
  date: 'lucide--calendar',
  time: 'lucide--calendar',
  group: 'lucide--layers',
  status: 'lucide--flag',
};

/** A control whose own `aria-label` is a sentence ("Filter by date range") needs a list-row name. */
const LABELS: Record<string, string> = {
  mddate: 'Captured',
  filter: 'Filter',
};

const PREFIX = /^(md|cm|dc|dg|db|vz)/;

/** The Lucide class for a refinement control's key. Never empty — an unmapped facet gets a filter glyph. */
export function refineFacetIcon(key: string | undefined): string {
  if (!key) return 'lucide--filter';
  return BY_NAME[key] ?? BY_CONCEPT[key.replace(PREFIX, '')] ?? 'lucide--filter';
}

/** A short list-row name, when the control's `aria-label` does not read as one. */
export function refineFacetLabel(key: string | undefined): string | undefined {
  return key ? LABELS[key] : undefined;
}
