/**
 * The Relationships status pill — ONE vessel, shared by both halves that paint it.
 *
 * Batch T. The Relationships table renders its Status cell twice, from two files:
 *   · `SchemaRelationships.astro` builds every SSR row (`relStatusBadge`);
 *   · `schemaRelationships.ts` re-builds the pill client-side for the synced-view tree row and
 *     again in `confirmRel`, when an inferred row is promoted to Valid.
 * Because an Astro component cannot be used inside an HTML string, neither half could migrate to
 * `<Badge>` — and, unpoliced, they had already DRIFTED: the controller’s copy carried `badge-sm`
 * and a `size-3` glyph, the SSR copy carried neither. Same pill, same table, two sizes, decided by
 * whether the row happened to be server-rendered or injected. `ds-lint` cannot see that, because
 * both spellings are individually legal.
 *
 * So the classes live here once and both halves call in. The colours are a LITERAL static map for
 * the reason D44 records at length in `SchemaRelationships.astro`: this used to interpolate
 * `badge-soft badge-${color}` with `neutral` among the three, which composed the BANNED
 * `badge-soft badge-neutral` pair for `Invalid` at render time — 1.34:1 text on dark — while a grep
 * for the literal pair read 0. An interpolated colour is invisible to static analysis and can name
 * a utility Tailwind never emits. Do not reintroduce one.
 */

export type RelStatusKey = 'valid' | 'inferred' | 'invalid';

export const REL_STATUS: Record<RelStatusKey, { cls: string; label: string; tip: string }> = {
  valid: { cls: 'badge-soft badge-success', label: 'Valid', tip: 'Active, working links' },
  inferred: {
    cls: 'badge-soft badge-primary',
    label: 'Inferred',
    tip: 'A guess we couldn’t confirm from Airtable — Confirm or Dismiss it',
  },
  // The neutral that WORKS (17.40:1 dark / 16.29:1 light). Never `badge-soft badge-neutral`.
  invalid: { cls: 'badge-ghost', label: 'Invalid', tip: 'Every link was removed — kept as history' },
};

/** Inferred is an AI verdict, so it takes the sparkles glyph the bulk bar uses; the rest take a dot. */
const glyph = (key: RelStatusKey) =>
  key === 'inferred'
    ? '<span class="iconify lucide--sparkles size-3.5" aria-hidden="true"></span>'
    : '<span class="size-1.5 rounded-full bg-current"></span>';

/** The status pill itself. This is the string BOTH halves must use — do not re-spell it. */
export const relStatusPill = (key: RelStatusKey): string => {
  const m = REL_STATUS[key];
  return `<span class="badge ${m.cls} rl-badge tooltip tooltip-left" data-tip="${m.tip}">${glyph(key)}${m.label}</span>`;
};

/** Some links were removed but the relationship still resolves — history, shown beside the status. */
export const REL_REMOVED_PILL =
  '<span class="badge badge-soft badge-warning rl-badge rl-b-removed tooltip tooltip-left" data-tip="Some links were removed — see the Changelog in the detail">Removed history</span>';

/**
 * The whole Status cell. The flex wrapper is load-bearing: with both pills present they sit inline
 * when they fit and wrap with a real gap when they don’t — the Valid + Removed-history overlap bug.
 */
export const relStatusCell = (key: RelStatusKey, hasRemovedHistory = false): string =>
  `<span class="rl-status-cell">${relStatusPill(key)}${hasRemovedHistory ? REL_REMOVED_PILL : ''}</span>`;

/** The Type column pill — also painted from both halves, also drifted on size. One spelling. */
export const relTypePill = (icon: string, label: string): string =>
  `<span class="badge badge-ghost rl-type-badge"><span class="iconify ${icon} size-3.5" aria-hidden="true"></span>${label}</span>`;
