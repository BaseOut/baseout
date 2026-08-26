/**
 * The header nav, asked whether its items still fit — and given somewhere to put the ones that do not.
 *
 * ── THE DEFECT, MEASURED AT 390 BEFORE ANY OF THIS ────────────────────────────────────────────
 * `.hx` carried `overflow-x: auto` plus `scrollbar-width: none`, and `Header.astro`'s own comment
 * called that "the honest failure mode". Measured on 2026-08-25 at an emulated 390x844 with
 * `pointer: coarse`, on all fifteen routes swept:
 *
 *   nav.scrollWidth 378  ·  nav.clientWidth 310 (docs) / 342 (service)  →  68px hidden
 *
 * Two things make it dishonest rather than honest. The scrollbar is suppressed, so nothing on the
 * screen says the row scrolls at all — the reader sees five items and a sixth sliced vertically down
 * the middle of a glyph, which reads as a rendering fault. And the row does not scroll the CURRENT
 * item into view: standing on `/contact/`, the pill carrying `aria-current="page"` — the one element
 * whose whole job is to answer "where am I" — painted as a soft-teal box containing the letters
 * `Con`, cut at the viewport edge. The item that is cut is the item you are on.
 *
 * ── WHY THIS AND NOT A WIDTH TABLE ────────────────────────────────────────────────────────────
 * `Header.astro` carries about a hundred lines costing each candidate label in pixels — 7.0px a
 * glyph, capitals 25% wider, plus 20px of pill padding — and the block's own postscript records that
 * "every estimate here runs about 19px optimistic". That arithmetic exists because the row had no
 * way to answer the question itself. It does now, and the standard for it is already written:
 * `specs/16-responsive.md` §6, on `toolbarFit.ts`'s frozen 1440 constant being deleted in favour of
 * asking the row whether it still fits — *"This IS now a mechanism to copy."* This is that copy.
 *
 * So no number here is a label width. The only inputs are `offsetWidth` readings taken from the
 * pills the browser has actually laid out, which means a label change, a font swap, a longer
 * translation and a 320px phone all come out right without anybody re-running the arithmetic.
 *
 * ── THE CURRENT ITEM IS NEVER THE ONE THAT FOLDS ──────────────────────────────────────────────
 * Items fold from the right, which is the ordinary priority+ rule and keeps the row's order stable.
 * The exception is the item marked `aria-current`: if the plain sweep would have folded it, the last
 * item that fits is folded instead and the current one takes its place. Order is preserved (the
 * current item is not moved, only kept), and the pill that answers "where am I" is on screen on
 * every route at every width.
 *
 * ── NO SCRIPT, NO REGRESSION ──────────────────────────────────────────────────────────────────
 * `More` ships `hidden` and the nav keeps `overflow-x: auto` until this module claims it with
 * `data-fit`. A reader with JavaScript off gets exactly what shipped before — a scrolling row —
 * rather than a row with items missing. The trigger is a `<summary>`, so the browser owns the
 * toggle, the keyboard and the open state; the same reason `ChatDock.astro` draws its cited-sources
 * list as a `<details>`.
 */

/* ── IT RUNS AT EVERY WIDTH (2026-08-26) ──────────────────────────────────────────────────────
 * The first version gated itself on `(max-width: 49.999rem)`, on the assumption that the one-row
 * desktop header always has room. It does not. Measured on `/contact/` at 800 and 834 — the band
 * between Starlight's `md` and the width where the row fits:
 *
 *     header content    813px of items in 752px of content box   (61px deficit at 800)
 *     .right-group      the account control past the right edge, clipped
 *
 * "Ask the row whether it fits" (`specs/16-responsive.md` §6) is not a rule about phones, and a
 * fitter that only runs on phones is the frozen constant that section deleted, wearing a media
 * query. So the gate is gone and the question is asked at 320 and at 2560 alike; where there is
 * room, nothing folds and `More` stays hidden.
 *
 * WHAT MADE IT MEASURABLE UP HERE. In the narrow layout `.hx` is a grid area with a definite width,
 * so `clientWidth` IS the room. In the desktop row it was `flex: none`, so `clientWidth` was its own
 * content width and the nav could never see that the row around it had run out — it would have
 * reported "386 of 386, fits" while 61px of header sat off-screen. `Header.astro` now gives it
 * `min-width: 0`, and since every other item in that row is `flex: none` the nav is the only
 * shrinkable one: it absorbs the whole deficit, and `clientWidth` becomes the truth again. The
 * pills themselves do not shrink — `white-space: nowrap` keeps each one's min-content at its label —
 * so the widths this reads stay honest while the container tells it how much room there is.
 */

/**
 * Sub-pixel slack. Layout positions the pills on fractional pixels, so a row that fits exactly can
 * still sum to a fraction more than the box it is in. One pixel is smaller than any gap or padding
 * this row uses, so it can never let a real overflow through.
 */
const EPSILON = 1;

interface Nav {
  nav: HTMLElement;
  links: HTMLElement[];
  more: HTMLDetailsElement;
  summary: HTMLElement;
  /** The menu copy of each link, index-aligned with `links`. */
  copies: HTMLElement[];
}

function read(nav: HTMLElement): Nav | null {
  const more = nav.querySelector<HTMLDetailsElement>('[data-nav-more]');
  const summary = more?.querySelector<HTMLElement>('summary');
  if (!more || !summary) return null;
  return {
    nav,
    links: [...nav.querySelectorAll<HTMLElement>('[data-nav-item]')],
    more,
    summary,
    copies: [...more.querySelectorAll<HTMLElement>('[data-nav-copy]')],
  };
}

/** Everything visible, nothing folded — the state every measurement is taken in. */
function reset(n: Nav): void {
  n.nav.removeAttribute('data-fit');
  n.more.hidden = true;
  n.more.open = false;
  for (const a of n.links) a.hidden = false;
  for (const c of n.copies) c.hidden = true;
}

function fit(n: Nav): void {
  reset(n);

  /* Read every width in one pass, before anything is hidden. `getBoundingClientRect` rather than
     `offsetWidth`: the pills are laid out at sub-pixel positions and rounding five of them up
     accumulates into a phantom item's worth of error.

     AND THE ROOM IS READ THE SAME WAY, which the first version did not do — it took `clientWidth`,
     an INTEGER, and compared it against a sub-pixel sum. Measured on `/contact/` at 1920, where the
     row has 700px to spare: `clientWidth` 386 against a total of 386.5, so the fitter folded
     `Roadmap` over half a pixel, on every width from 900 up, on exactly the pages whose current
     label is long enough to round the wrong way. Two readings of one box have to be taken in the
     same units, and `EPSILON` covers the rounding that is left. */
  const room = n.nav.getBoundingClientRect().width + EPSILON;
  const widths = n.links.map((a) => a.getBoundingClientRect().width);
  const gap = parseFloat(getComputedStyle(n.nav).columnGap) || 0;
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
  if (total <= room) return; // The row fits. `More` stays hidden and nothing is claimed.

  /* `More` is only measurable while it is on screen, and it is not on screen until we know we need
     it — which we now do. Show it, measure it, then spend the rest of the row. */
  n.more.hidden = false;
  const moreW = n.summary.getBoundingClientRect().width + gap;

  const keep = new Set<number>();
  let used = moreW;
  for (let i = 0; i < n.links.length; i++) {
    const cost = widths[i] + (keep.size ? gap : 0);
    if (used + cost > room) break;
    keep.add(i);
    used += cost;
  }

  /* The current item, if the sweep above dropped it. Trade the last kept items for it rather than
     adding to the row: the row is already exactly full, so an addition would put us straight back
     over the edge with one more pill on it.

     THE TRADE CAN FAIL, and the failure is handled rather than assumed away. Emptying the row does
     not help if the current item is on its own wider than the room left beside `More`; forcing it in
     anyway is what would push the nav past its box, and `data-fit` has just turned the clipping off.
     So it stays folded and the trigger says so — see `data-holds-current` in the styles. Not
     reachable with today's labels (the longest pill is 91px, the narrowest row 240px at 320), which
     is exactly why it needs writing down rather than trusting. */
  const current = n.links.findIndex((a) => a.getAttribute('aria-current') === 'page');
  if (current >= 0 && !keep.has(current)) {
    const kept = [...keep].sort((a, b) => a - b);
    for (let k = kept.length - 1; k >= 0 && used + widths[current] + gap > room; k--) {
      keep.delete(kept[k]);
      used -= widths[kept[k]] + gap;
    }
    if (used + widths[current] + gap <= room) {
      keep.add(current);
      used += widths[current] + gap;
    }
  }

  for (let i = 0; i < n.links.length; i++) {
    const shown = keep.has(i);
    n.links[i].hidden = !shown;
    if (n.copies[i]) n.copies[i].hidden = shown;
  }

  /* Claimed. The CSS drops the scroller (a clipped nav cannot render an open menu) and paints the
     trigger as current when the item it is standing in for is. */
  n.nav.setAttribute('data-fit', '');
  n.more.toggleAttribute('data-holds-current', current >= 0 && !keep.has(current));
}

export function wireNavOverflow(): void {
  const navs = [...document.querySelectorAll<HTMLElement>('[data-nav-fit]')]
    .map(read)
    .filter((n): n is Nav => n !== null);
  if (!navs.length) return;

  const run = () => navs.forEach(fit);
  run();

  /* Width is not the only input: a font arriving late re-lays the pills out at different widths, and
     the first measurement was taken against the fallback. Both observers are cheap and both have
     shipped bugs in this repo when they were left out. */
  new ResizeObserver(run).observe(document.documentElement);
  document.fonts?.ready.then(run);

  /* A click anywhere outside closes it. `<details>` has no light-dismiss of its own, and a menu that
     stays open while the reader taps the page behind it is the same defect `account-menu.ts` §3
     describes — solved the same way, with one document listener rather than one per instance. */
  document.addEventListener('click', (e) => {
    for (const n of navs) {
      if (n.more.open && !n.more.contains(e.target as Node)) n.more.open = false;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const n of navs) {
      if (!n.more.open) continue;
      e.stopPropagation();
      n.more.open = false;
      n.summary.focus();
    }
  });
}
