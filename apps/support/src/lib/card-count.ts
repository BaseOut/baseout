/**
 * `?cards=N` — how the landing's platform chooser looks with a DIFFERENT NUMBER OF PLATFORMS.
 *
 * A REVIEW INSTRUMENT, AND BUILT TO BE DELETED. It is the same family as `lib/shot-switch.ts` and
 * it carries the same warning for the same reason: nothing here is a product feature, no visitor
 * can reach it, and the day the strip's layout is agreed this module and the padding markup in
 * `PlatformStart.astro` go out together. It is written down rather than left implicit because the
 * last review switch on this page survived three weeks past its decision.
 *
 * WHY IT HAD TO EXIST. The chooser draws one card per platform that has a documentation tree, and
 * `documented-platforms.ts` derives that from the filesystem — three today, and no URL, preference
 * or parameter moves that number. So the layout at one platform, at five, and at eight is
 * unreviewable: the only way to see it would be to write or delete documentation trees. Oleh,
 * 2026-08-21: "мені треба бачити, як по-іншому інтерфейс виглядає. Це просто не покрито."
 *
 * IT IS NOT `?platform=`, AND MUST NEVER BECOME IT. That parameter narrows what the reader has
 * CHOSEN; it deliberately leaves the chooser drawing every documented platform, because a control
 * you pick FROM that has narrowed itself to the one thing you already picked offers one option and
 * no way back. This parameter changes how many platforms the portal PRETENDS to have. Two different
 * questions, and conflating them is the one mistake available here.
 *
 * WHAT IT IS ALLOWED TO TOUCH. The strip, and nothing else. It writes no `localStorage`, fires no
 * `FILTER_EVENT`, and does not rewrite the address bar — so the steps, the documentation directory,
 * the sidebar and the roadmap below and beside it are all exactly as they would be without it. A
 * review switch that left a stored preference behind would keep changing the portal for whoever
 * used it next, and they would have no idea why.
 *
 * IT RUNS AFTER PAINT, unlike the treatment switch. `shot-switch`'s choice is stamped by a pre-paint
 * inline script in `LandingBody.astro` because a visitor must never see the losing variant flip.
 * Nobody arrives here by accident, so a frame of the real three-card strip before the padded one is
 * a cost worth not paying an unchecked inline script for.
 *
 * ── THE LAYOUT RULE THIS PARAMETER EXISTS TO SHOW ────────────────────────────────────────────
 * The strip is ONE ROW of equal cards up to `ROW_MAX`, and a STACK of compact rows above it. The
 * threshold is arithmetic, not taste. The landing's measure is `max-width: 72rem` = 1152px, the
 * grid gap is 12px, and `CARD_MIN` = 220px is the narrowest a card can be and still hold a brand
 * mark, a name and a two-line vocabulary line as one object:
 *
 *     columns that fit = floor((1152 + 12) / (220 + 12)) = floor(1164 / 232) = 5
 *
 * So five is the largest row the page has room for — which is what Oleh guessed, and this is the
 * arithmetic that agrees with him rather than a nod. Six would give (1152 - 60) / 6 = 182px cards,
 * 142px inside the padding, where the vocabulary line breaks to three lines and the card reads as a
 * column of fragments.
 *
 * ABOVE FIVE IT STACKS RATHER THAN SCROLLS, and the horizontal scroller was rejected on what the
 * control is for: this is the one element on the portal whose entire job is to show every platform
 * that exists, and a scroller answers "which platforms are there?" with "some of them, swipe". It
 * also has no honest empty-to-full affordance at the exact moment the answer matters — a reader who
 * does not see their platform must be able to conclude it is not there. Stacking costs vertical
 * space on the page's most important fold, which is real; the compact row form is the answer to
 * that (mark, name and nouns on one line, ~48px instead of ~150px), so eight stacked rows cost
 * about 440px against 312px for a two-row grid of eight cards. 128px of height, in exchange for
 * never hiding an option.
 */

/** The parameter, named once. */
export const CARDS_PARAM = 'cards';

/** The narrowest a card may be drawn. The row/stack threshold is derived from this, not declared. */
export const CARD_MIN = 220;

/** The landing's measure, `LandingBody.astro`'s `.vb { max-width: 72rem }`. */
export const ROW_WIDTH = 1152;

/** `.ps-grid`'s gap. */
export const CARD_GAP = 12;

/** The most cards one row can hold at the measured width: floor((1152 + 12) / (220 + 12)) = 5. */
export const ROW_MAX = Math.floor((ROW_WIDTH + CARD_GAP) / (CARD_MIN + CARD_GAP));

/**
 * The most cards the strip can DRAW, which is a fact about honesty rather than about layout: five
 * real identities live in `lib/platforms.ts`, and beyond those `PlatformStart.astro` renders
 * unnamed placeholder cards. No sixth brand was invented to fill a row.
 */
export const CARDS_MAX = 8;

export const CARDS_MIN = 1;

/** True when `n` cards must be stacked rather than laid in one row. */
export const stacks = (n: number): boolean => n > ROW_MAX;

/** The requested count, or null when the parameter is absent or not a count we can draw. */
export function requestedCount(search: string): number | null {
  const raw = new URLSearchParams(search).get(CARDS_PARAM);
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n < CARDS_MIN || n > CARDS_MAX) return null;
  return n;
}

/**
 * Draws the strip with `n` cards.
 *
 * THE HIDE IS AN ATTRIBUTE AND A RULE, NOT `style.display`. `.ps-grid > li` carries an author
 * `display: flex`, and an author `display` BEATS the `hidden` attribute's UA rule — this app has
 * already shipped one variant that stayed on screen for exactly that reason. `PlatformStart.astro`
 * therefore writes `.ps-grid > li[hidden] { display: none }` explicitly, and this function only
 * toggles the attribute.
 */
function draw(root: HTMLElement, n: number): void {
  for (const grid of root.querySelectorAll<HTMLElement>('.ps-grid')) {
    const cards = grid.querySelectorAll<HTMLElement>(':scope > li');
    cards.forEach((li, i) => {
      li.toggleAttribute('hidden', i >= n);
    });
  }
  root.style.setProperty('--ps-n', String(n));
  root.dataset.psLayout = stacks(n) ? 'stack' : 'row';
}

/**
 * Applies `?cards=` if it is there, and does nothing at all if it is not.
 *
 * DOING NOTHING IS THE POINT OF THE EARLY RETURN. The server has already rendered the true state —
 * every documented platform, in a row — so a "reset to the real count" path here would be a second
 * authority on a number that has exactly one source.
 */
export function mountCardCount(): void {
  const root = document.querySelector<HTMLElement>('[data-platform-start]');
  if (!root) return;
  const n = requestedCount(window.location.search);
  if (n === null) return;
  draw(root, n);
}
