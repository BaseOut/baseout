/**
 * entityIcon — the ONE concept-glyph mapping for a schema entity's KIND: base / table / field /
 * view, plus the app-layer kinds space / automation / interface / page. Used anywhere a kind
 * needs its icon — Browse tree rows, tag chips, dropdown options, the drawer breadcrumb
 * (styles/global.css `.sb-crumb-ic`), and the changelog/comments Location column.
 *
 * This replaced FIVE copies of the same base/table/field/view ternary, most of them
 * character-for-character identical: `schemaReadBody.ts`, `schemaInterfaces.ts`,
 * `schemaAutomations.ts`, `SchemaHealth.astro` (inline), and `EntityPanel.astro`'s `kindIcon`.
 * Import from here — do not write a sixth.
 *
 * FIELD is the one deliberate exception. This module's `field` glyph is the generic
 * `lucide--tag` used by chips/crumbs that only know the entity's KIND. `EntityPanel.astro`'s
 * `kindIcon` is richer for fields — it shows the field's actual Airtable TYPE icon (via its own
 * `fieldIcon()` / `AIRTABLE_FIELD_ICONS`) when the entity carries a `fieldType`, and only falls
 * back to this module for every other kind. That richer per-type lookup stays local to
 * EntityPanel; flattening it into this shared mapping would be a downgrade for Browse.
 */

export type EntityGlyphKind = 'space' | 'base' | 'table' | 'record' | 'field' | 'view' | 'automation' | 'interface' | 'page' | 'asset';

const CLASS: Record<EntityGlyphKind, string> = {
  space: 'lucide--layers',
  base: 'lucide--database concept-ic-base',
  table: 'lucide--table-2 concept-ic-table',
  /**
   * RECORD (Oleh, 2026-07-30). Before this decision a record had SIX different treatments and no
   * two agreed: an empty 14px crumb slot, `lucide--table-2` (the table's glyph on loan),
   * `lucide--circle-dot` in Docs, `lucide--rows-3` in the chat chips, `lucide--hash` for the record
   * ID column, and bare text. `circle-dot` won because the other candidates were already spoken
   * for: `table-2` means a TABLE, `rows-3` already means "how many records" beside every count in
   * EntityPanel / Reports / Home, and `hash` means the ID rather than the thing.
   */
  record: 'lucide--circle-dot concept-ic-record',
  field: 'lucide--tag concept-ic-field',
  view: 'lucide--eye concept-ic-view',
  automation: 'lucide--zap concept-ic-automation',
  interface: 'lucide--layout-panel-left concept-ic-interface',
  page: 'lucide--file concept-ic-page',
  /**
   * ASSET (media-library, 2026-07-31) — a captured attachment as an ENTITY kind. `paperclip`, not
   * `image`: an image is ONE of the five media kinds this entity covers (the others are video,
   * audio, document and archive), and the per-file glyph is already `attGlyph()`'s job in
   * `components/data/mediaFormat.ts`. Paperclip is also the word the surface uses — the Comments
   * feed's Files column and the Attachments tab both wear it.
   */
  asset: 'lucide--paperclip concept-ic-asset',
};

/** Bare iconify class(es) for a concept kind, e.g. `lucide--database concept-ic-base` — the form
 *  a caller drops into its own `<span class="iconify ${entityIconClass(kind)} size-3.5">`. An
 *  unrecognized kind falls back to a plain circle rather than throwing. */
export function entityIconClass(kind: string): string {
  return CLASS[kind as EntityGlyphKind] ?? 'lucide--circle';
}

/** Ready `<span>` markup for a concept glyph. `size` is a Tailwind icon-size utility (default
 *  `size-3.5`, the feed/crumb/chip standard) — pass `''` when the caller sizes the icon itself via
 *  a wrapping CSS rule (e.g. EntityPanel's `.ep-row-ic .iconify`). Always `aria-hidden`: a concept
 *  glyph is decorative and must add nothing to the accessible name. */
export function entityIconMarkup(kind: string, opts: { size?: string; extraClass?: string } = {}): string {
  const { size = 'size-3.5', extraClass = '' } = opts;
  const cls = [entityIconClass(kind), size, extraClass].filter(Boolean).join(' ');
  return `<span class="iconify ${cls}" aria-hidden="true"></span>`;
}
