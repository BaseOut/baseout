/**
 * entityChip — the ONE standard "entity reference chip" for the Schema UI.
 *
 * A small soft pill that references a schema entity (table / field / doc / chat / etc.):
 * a leading type icon + name + optional muted context, rendered as a clickable button
 * (opens the entity) or a static span, optionally removable (trailing ×) or derived/auto.
 *
 * Chips are injected at runtime via set:html/innerHTML from the `.ts` tab controllers, so an
 * Astro component can't be used inside those strings — this builder is the single source of
 * chip MARKUP, and `styles/global.css` (`.sb-chip*`) is the single source of chip CSS.
 * NEVER hand-roll a chip; always call entityChip(). Catalog entry: /styleguide → Entity chip.
 */
const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface EntityChipOpts {
  /** Display name (escaped by the builder). */
  name: string;
  /** Leading icon as raw HTML — a field-type <svg> or an `<span class="iconify …">`. Caller-safe. */
  icon: string;
  /** Muted trailing context (e.g. a table name); the builder adds the "· " and the muted span. */
  context?: string;
  /** Render as a clickable <button> (opens the entity) instead of a static <span>. Removable forces span. */
  clickable?: boolean;
  /** Extra raw attributes on the chip root (e.g. `data-entity-open="f-1"` — the existing click hooks). */
  attrs?: string;
  /** Raw attributes for the trailing × button (e.g. `data-au-chip-x="f-1"`). Presence ⇒ removable (span). */
  remove?: string;
  /** Auto/derived tag styling (subtly muted, dashed) — the non-removable "engine-derived" variant. */
  derived?: boolean;
}

export function entityChip(o: EntityChipOpts): string {
  const removable = !!o.remove;
  // A removable chip nests a × <button>, so it must be a <span> (no button-in-button).
  const asButton = !!o.clickable && !removable;
  const cls = [
    'sb-chip',
    asButton ? 'sb-chip-btn' : 'sb-chip-static',
    removable ? 'sb-chip-removable' : '',
    o.derived ? 'sb-chip-derived' : '',
  ].filter(Boolean).join(' ');
  const ctx = o.context ? `<span class="sb-chip-ctx">· ${esc(o.context)}</span>` : '';
  const x = removable
    ? `<button type="button" class="sb-chip-x" ${o.remove} aria-label="Remove"><span class="iconify lucide--x size-3" aria-hidden="true"></span></button>`
    : '';
  const inner = `<span class="sb-chip-ic" aria-hidden="true">${o.icon}</span><span class="sb-chip-name">${esc(o.name)}</span>${ctx}${x}`;
  const attrs = o.attrs ? ` ${o.attrs}` : '';
  return asButton
    ? `<button type="button" class="${cls}"${attrs}>${inner}</button>`
    : `<span class="${cls}"${attrs}>${inner}</span>`;
}
