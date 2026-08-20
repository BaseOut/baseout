/**
 * popoverPlace — where a popover goes, and nothing else.
 *
 * WHY IT IS ITS OWN MODULE (2026-08-05). This maths was written inside
 * `panelAddPicker.ts` because that is where it was first needed, not because it belongs there:
 * it knows nothing about pickers, sources, scope or search. `EntityPanel.astro` then imported it
 * ACROSS the A/B seam — the `/schema` variant reaching into the `/data` variant's file — so
 * deleting the losing variant would have broken the surviving one. Placement is neutral ground
 * now, and each variant is a clean single-file delete.
 *
 * Two rules, and both were bugs first. **Measure the ELEMENT**: a width literal in JS and a width
 * in CSS are one number written twice, and they disagreed the day one of them changed. **Clamp to
 * the CONTENT column, not the viewport**: clamping to the viewport let the popover slide under the
 * app's left navigation and the Data page's preset rail. The height is measured for the same
 * reason the width is — the `420` that used to sit here was the popover's height, restated.
 *
 * The element must already be UNHIDDEN when this is called; a `hidden` element measures 0×0 and
 * would be placed against nothing. Callers that also repaint the popover's contents must repaint
 * BEFORE placing, or they measure the previous open's height.
 */

/** Gap between the anchor and the popover, and the margin the popover keeps from any hard edge. */
const GAP = 8;
const EDGE = 12;

/**
 * Clamp a BELOW-anchor popover — `position: absolute; left: 0` under the control that opened it —
 * so its far edge stays inside the content column.
 *
 * A different placement model from `placePopover` above, which puts a fixed popover BESIDE its
 * anchor; running one through the other would move the panel sideways off its trigger. What both
 * share is the rule, and the rule is the part that was a bug: clamp to the CONTENT column, not the
 * viewport.
 *
 * The failure this ends is width that arrives late. A dropdown is 320 when it opens, so `left: 0`
 * is safe; drill into a facet that declares a wider form — Records' 660px condition builder — and
 * the panel grows to the right, off the screen, because nothing re-places it. Oleh, at 1100:
 * «вікно, воно, в залежності від позиції, ховається за край екрана… примусово його виставляти
 * ближче до середини». Measured there: right edge 1135 against a 1100 viewport, 35px unreachable.
 *
 * So call it AFTER any change to the popover's width or contents, not only on open. The left edge
 * wins ties: a panel wider than the column starts at the column's edge and scrolls or wraps
 * internally, rather than hiding its first column instead of its last.
 */
export function clampBelow(pop: HTMLElement, anchor: HTMLElement): void {
  pop.style.left = '';
  const W = pop.getBoundingClientRect().width;
  const a = anchor.getBoundingClientRect().left;
  const main = document.querySelector('main') || document.body;
  const m = main.getBoundingClientRect();
  const minLeft = Math.max(EDGE, m.left + GAP);
  const maxLeft = Math.min(window.innerWidth, m.right) - EDGE - W;
  const left = Math.max(minLeft, Math.min(a, maxLeft));
  if (Math.round(left) !== Math.round(a)) pop.style.left = `${Math.round(left - a)}px`;
}

/** Place an already-unhidden popover next to the control that opened it. */
export function placePopover(el: HTMLElement, r: DOMRect): void {
  const { width: W, height: H } = el.getBoundingClientRect();
  const main = document.querySelector('main') || document.body;
  const minLeft = Math.max(EDGE, Math.round(main.getBoundingClientRect().left) + GAP);
  const left = r.left - W - GAP >= minLeft ? r.left - W - GAP : Math.min(r.right + GAP, window.innerWidth - W - EDGE);
  el.style.left = Math.max(minLeft, left) + 'px';
  el.style.top = Math.max(EDGE, Math.min(r.top, window.innerHeight - H - EDGE)) + 'px';
}
