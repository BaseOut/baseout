/**
 * clipTips — recover what truncation hides, on any feed, from ONE implementation.
 *
 * Extracted from `DataComments.astro` (2026-08-10, D10 fix pass) when the Schema and Data
 * changelogs turned out to need the identical thing. The Comments feed had this machinery,
 * carefully measured, entirely private, and pointed at a THREE-SELECTOR list that named none of
 * the Location-column spans — so a base called "Sales CRM" rendered as "Sales …" with no way to
 * read it, on a surface every other list in the app is told to copy.
 *
 * That is the failure the picker's own note already called out in these words: *"A rule stated for
 * one element is not a rule."* Three feeds share `.cl-entry`; a truncation rule that lives inside
 * one of them is a rule for one of them.
 *
 * ── THE RULE (pattern-audit-table) ────────────────────────────────────────────────────────────
 * Explanatory text in a cell never drives column width: it truncates with an ellipsis and carries
 * its full text on a tooltip. The tooltip is attached ONLY to cells that are ACTUALLY clipped —
 * putting one on all 20 rows means 17 tooltips repeating text already fully visible, which trains
 * the reader to ignore the three that carry something new.
 *
 * ── TWO THINGS THAT LOOK LIKE DETAILS AND ARE NOT ─────────────────────────────────────────────
 *
 * 1 · `data-tip` ONLY — deliberately NOT the `tooltip` class. The shared controller
 *     (`components/ui/tooltip.ts`) paints every `[data-tip]` in the top layer and reads the class
 *     purely to pick a side, while daisyUI's own pseudo-element is switched off in `global.css`.
 *     The class is actively harmful here: it sets `display: inline-block`, which changed the row
 *     height (43px against the feed's 40px) AND altered the very `scrollWidth`/`clientWidth` this
 *     check reads — measuring made the thing measured stop being clipped. Both were measured.
 *
 * 2 · The tip must be set on the SPAN THAT CLIPS, never on a wrapper. `tooltip.ts` suppresses a
 *     hint that merely repeats a label it can read on screen, and its ONE exception is
 *     `scrollWidth > clientWidth` — true of the clipping span, false of the row around it. Put the
 *     tip on the wrapper and the echo rule eats it silently, with every gate green.
 *
 * ── WHY A ResizeObserver AND NOT A window RESIZE LISTENER ─────────────────────────────────────
 * A tab is `display: none` until it is selected, so at wire time every cell measures 0 wide and
 * NOTHING reads as clipped; a window listener would never fire to correct it and the tooltips
 * would simply never appear (measured on Comments: 23 clipped cells, 0 tooltips). The observer
 * fires when the feed is first laid out as well as on every later width change.
 *
 * `recheck()` is returned for the other case the observer cannot see: PAGING and FILTERING. A row
 * hidden with `display: none` measures 0 and loses its tip; when the pager brings it back the feed
 * has not changed size, so nothing fires. Every host calls `recheck()` at the end of its `apply()`.
 */

export interface ClipTipsOptions {
  /** The element whose width changes should re-measure — the feed / table body. */
  observe: HTMLElement;
  /** The rows to walk. A function, because a feed can re-render its rows under the mount. */
  rows: () => HTMLElement[];
  /** Which cells inside a row may clip. A CSS selector list. */
  selector: string;
}

export interface ClipTips {
  /** Re-measure now (rAF-batched). Call after paging, filtering or a re-render. */
  recheck: () => void;
  /** Stop observing. */
  destroy: () => void;
}

export function mountClipTips(opts: ClipTipsOptions): ClipTips {
  const { observe, rows, selector } = opts;

  const markClipped = () => {
    rows().forEach((row) => {
      row.querySelectorAll<HTMLElement>(selector).forEach((cell) => {
        // CLIPPING IS EITHER AXIS. This read `scrollWidth > clientWidth` only, which is the test for
        // a one-line ellipsis — and it is blind to the other truncation this app uses, a
        // `-webkit-line-clamp` that hides OVERFLOWING LINES at the same width. The Backups log's
        // two-line sentence measured 7 clipped cells and got 2 tooltips until this was added.
        const clipped = cell.scrollWidth > cell.clientWidth + 1 || cell.scrollHeight > cell.clientHeight + 1;
        const shown = (cell.textContent || '').trim();
        // `data-full` is set where the row deliberately renders LESS than it knows — the author
        // cell shows an email's local part. Such a cell needs the tooltip even when it fits,
        // because the shortening, not the width, is what hid the rest.
        const full = cell.dataset.full || shown;
        if (!full) { cell.removeAttribute('data-tip'); return; }
        if (clipped || full !== shown) cell.setAttribute('data-tip', full);
        else cell.removeAttribute('data-tip');
      });
    });
  };

  let raf = 0;
  const recheck = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(markClipped);
  };

  const ro = new ResizeObserver(recheck);
  ro.observe(observe);

  return {
    recheck,
    destroy: () => { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
