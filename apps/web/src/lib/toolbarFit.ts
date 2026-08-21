/**
 * toolbarFit — stamp `data-narrow` on a toolbar that has run out of room.
 *
 * `pattern-collapsing-search` and the label-dropping rule beside it were both gated on
 * `@media (max-width: 1599.98px)` — the VIEWPORT. Split view broke that assumption on 2026-08-05: at
 * a 1440 laptop with split on, the content column is ~795px while the media query still reads 1440
 * and keeps the wide layout. Measured — the Data toolbar went from one row to four while the media
 * tier reported the identical `1024-1600 laptop` in both states.
 *
 * So the question moves to the element that actually ran out: the toolbar itself.
 *
 * ── WHY THERE IS NO LONGER A NUMBER HERE (Oleh ruling 7, 2026-08-14) ────────────────────────────
 * There used to be: `const NARROW_AT = 1440`, compared against `#layout-content`'s `clientWidth`.
 * That comparison could never evaluate false on the hardware this product is used on. Measured
 * 2026-08-14 in a 1440-wide viewport: `#layout-content` is **1184** — the sidebar takes 256 — so
 * `1184 < 1440` was true at a full-screen laptop, true at 1600, true at 1920 with the sidebar
 * expanded. `data-narrow` was not a narrow adaptation; it was the only state `.sch-tb` ever had, and
 * the six CSS rules written as "below 1440 we drop the button words and collapse the search" were in
 * fact the permanent rendering of nine surfaces.
 *
 * The number was wrong because it was in the wrong UNITS: it was derived from a VIEWPORT ladder
 * (1600 window ⇒ ~1272 of toolbar ⇒ Browse needs ~1440 with the field open) and then applied to the
 * COLUMN, which is always ~256 smaller than the window it was reasoned about. Restating it as 1184
 * would only move the arbitrary constant; it would still be a guess about one surface's content
 * applied to nine, and it would go stale the first time a toolbar gained a control.
 *
 * So the threshold is gone and the toolbar is ASKED instead: laid out in its wide form, does this
 * row still fit on one line? `.sch-tb` is `flex-wrap: wrap`, so "ran out of room" has a physical
 * signature — a second row — and the collapsing rules exist for exactly one purpose, which is to
 * prevent it. That is a measurement of the toolbar's own need, at whatever width it happens to have,
 * and it stays true when the width is taken by a panel instead of a small screen.
 *
 * Cost, stated plainly: this reads layout inside a `ResizeObserver`. It is coalesced to one pass per
 * frame per section, it writes then reads once (one forced sync layout, no paint in between), and it
 * touches only `.sch-tb` elements — single digits per page.
 */

/**
 * The ANSWER is the SECTION's, and every toolbar in it is stamped the same.
 *
 * It used to be each toolbar's own width, which produced the thing Oleh reported on 2026-08-06: the
 * same button was a word on one tab and an icon on the next, at one window size. The cause is that
 * the tabs are not the same width — Records carries a 240px preset library down its left, so its
 * toolbar is 240 narrower than Attachments' while the SECTION either side of them is identical. A
 * per-toolbar answer therefore says something different per tab, and the user sees a section that
 * cannot make up its mind.
 *
 * His rule, and it is the right one: "якщо тут коротка кнопка з іконкою, значить всюди" — at one
 * section width, one answer. So the toolbars are measured individually (each knows its own content)
 * and the results are OR-ed: if ANY toolbar in the section needs the narrow form, they all take it.
 *
 * NOT the viewport, still: split view changes this column without touching the window, which is what
 * broke the `@media` version this replaced.
 */
function sectionOf(tb: HTMLElement): HTMLElement | null {
  return (tb.closest('#layout-content') as HTMLElement | null) || (tb.closest('main') as HTMLElement | null);
}

/**
 * Does this row occupy more than one line?
 *
 * NOT `offsetTop` per child — that was tried and it is wrong here: `.sch-tb` is `align-items: center`,
 * so a 28px chip beside a 32px button sits 2px lower ON THE SAME LINE. Measured on /reports at 1440,
 * 1280 and 1100, an `offsetTop` test called every one of them "two rows" while the toolbar was 32px
 * tall. Height against the tallest child is the question actually being asked.
 */
function wraps(tb: HTMLElement): boolean {
  const kids = Array.from(tb.children).filter((k): k is HTMLElement => k instanceof HTMLElement && k.offsetParent !== null);
  if (kids.length < 2) return false;
  const tallest = kids.reduce((a, k) => Math.max(a, k.offsetHeight), 0);
  if (tallest <= 0) return false;
  const cs = getComputedStyle(tb);
  const inner = tb.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
  // 1px of tolerance for sub-pixel row heights; a real second row costs at least the row gap.
  return inner > tallest + 1;
}

/**
 * One pass over a section: measure every toolbar in its WIDE form, then stamp them all alike.
 *
 * The measurement HAS to happen with `data-narrow` off. Asking a collapsed toolbar whether it fits
 * answers a different question — the collapsed row fits by construction, that is what collapsing is
 * for — and stamping on that answer oscillates: wide ⇒ wraps ⇒ narrow ⇒ fits ⇒ wide. Removing the
 * attribute first makes the answer a pure function of the available width, so it is stable.
 *
 * `data-tb-measuring` is not decoration. The search field carries `transition: width 160ms`, and a
 * transitioned property reports its INTERPOLATED value the instant the style flushes — so the
 * un-narrowed field would measure 32px, the width it is animating away from, and every toolbar would
 * be judged to fit. The attribute switches those transitions off for the duration of the read
 * (global.css, beside the transitions themselves).
 */
function restamp(root: ParentNode, col: HTMLElement): void {
  const all = Array.from(root.querySelectorAll<HTMLElement>('.sch-tb')).filter((tb) => sectionOf(tb) === col);
  if (!all.length) return;
  // Enrol anything that arrived since the last pass, so a late tab panel is both stamped now and
  // watched from now on.
  const obs = toolbarObs.get(col);
  if (obs) all.forEach((tb) => { if (!wired.has(tb)) { wired.add(tb); obs.observe(tb); } });
  // An OPEN search is 420px of overlay hanging off the row; measuring through it answers a question
  // about a transient state, and re-flowing the row under a pointer that just aimed at it is exactly
  // what the overlay was built to avoid. Keep the last answer until the field closes.
  if (col.querySelector('.sch-tb-search.tbs-open')) return;

  all.forEach((tb) => {
    tb.setAttribute('data-tb-measuring', '');
    tb.removeAttribute('data-narrow');
  });
  // One forced sync layout for the whole section — the writes above are all done before the first read.
  const narrow = all.some((tb) => tb.clientWidth > 0 && wraps(tb));
  all.forEach((tb) => {
    // A hidden tab measures 0 and contributes nothing to the vote, but it still takes the section's
    // answer — so revealing it shows a toolbar that already agrees with its neighbours instead of
    // correcting itself mid-paint.
    if (narrow) tb.setAttribute('data-narrow', '');
    else tb.removeAttribute('data-narrow');
    tb.removeAttribute('data-tb-measuring');
  });
}

const seen = new WeakSet<Element>();
/**
 * The per-column toolbar observer, kept so LATE toolbars can be enrolled.
 *
 * They are real: measured 2026-08-14 on /schema, the page had 5 `.sch-tb` at one moment and 6 at
 * the next — the tab panels do not all exist at wire time. A toolbar that appeared after wiring was
 * never stamped, so at a 500px column five toolbars said narrow and the sixth said wide: exactly the
 * "section that cannot make up its mind" this module exists to prevent, just one level later.
 */
const toolbarObs = new WeakMap<HTMLElement, ResizeObserver>();
const wired = new WeakSet<Element>();

/** Observe every toolbar on the page. Safe to call again — each element is wired once. */
export function watchToolbars(root: ParentNode = document): void {
  const all = Array.from(root.querySelectorAll<HTMLElement>('.sch-tb'));
  if (!all.length) return;

  const cols = new Set<HTMLElement>();
  all.forEach((tb) => {
    const col = sectionOf(tb);
    if (col) cols.add(col);
  });

  cols.forEach((col) => {
    if (seen.has(col)) return;
    seen.add(col);
    let queued = 0;
    const schedule = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        restamp(root, col);
      });
    };
    // The COLUMN: the section changed width (window, sidebar, split view).
    new ResizeObserver(schedule).observe(col);
    // Each TOOLBAR: a hidden tab going 0 → N is the one change the column cannot see, and it is the
    // moment a tab switch would otherwise leave the revealed row measured but never re-asked.
    toolbarObs.set(col, new ResizeObserver(schedule));
    // A toolbar that does not exist yet cannot be observed, and revealing a tab need not change the
    // column's box. So watch the subtree for one thing: a `.sch-tb` arriving. `schedule` coalesces,
    // so a burst of DOM writes costs one pass.
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of Array.from(r.addedNodes)) {
          if (n instanceof HTMLElement && (n.classList.contains('sch-tb') || n.querySelector('.sch-tb'))) {
            schedule();
            return;
          }
        }
      }
    }).observe(col, { childList: true, subtree: true });
  });
  // Called again (astro:page-load, a tab that just rendered): re-stamp every known section so a
  // toolbar that did not exist a moment ago is enrolled and answers the same as its neighbours.
  cols.forEach((col) => restamp(root, col));
}
