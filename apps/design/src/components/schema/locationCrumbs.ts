/**
 * locationCrumbs — the ONE breadcrumb builder for every Schema detail-drawer header.
 *
 * Returns the crumb SEGMENTS (buttons/spans + `›` separators) for a location trail
 * (Base ▸ Table ▸ … / Base ▸ parent-interface). Drop the result into the drawer's crumb
 * `<nav class="sb-crumb-row">` container. The CSS lives once in styles/global.css (`.sb-crumb*`).
 * Every drawer uses this — never hand-roll a breadcrumb. Catalog: /styleguide → Location crumbs.
 */
const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface CrumbSeg {
  /** Segment label (escaped by the builder). */
  name: string;
  /** Leading concept icon as raw HTML (a field-type <svg> or `<span class="iconify …">`). Optional. */
  icon?: string;
  /** Raw attributes making this segment a clickable <button> (e.g. `data-entity-open="t-1"`). The
   *  LAST segment (the current entity) is always rendered muted + non-clickable regardless. */
  openAttrs?: string;
}

/** Build the crumb-row inner HTML. A segment WITH openAttrs is a clickable link; a segment WITHOUT
 *  is a muted, non-clickable span (use that for a current/deleted node). The canonical drawer usage
 *  passes the entity's ANCESTORS (all clickable) — the current entity is the header title, not a crumb. */
export function locationCrumbs(segs: CrumbSeg[]): string {
  return segs
    .map((s, i) => {
      const sep = i > 0 ? '<span class="iconify lucide--chevron-right size-3 sb-crumb-sep" aria-hidden="true"></span>' : '';
      const ic = s.icon ? `<span class="sb-crumb-ic" aria-hidden="true">${s.icon}</span>` : '';
      const inner = `${ic}<span class="sb-crumb-name">${esc(s.name)}</span>`;
      const el = s.openAttrs
        ? `<button type="button" class="sb-crumb sb-crumb-link" ${s.openAttrs}>${inner}</button>`
        : `<span class="sb-crumb">${inner}</span>`;
      return sep + el;
    })
    .join('');
}
