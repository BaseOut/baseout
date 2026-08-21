/**
 * The one viewport boundary, and nothing else.
 *
 * THIS FILE USED TO CARRY A PRODUCT MODEL, and the model is gone (Oleh, 2026-08-12: «треба взагалі
 * про фон передивитися, виділити всі згадки про фон, тому що нам це не потрібно, ми це вже
 * зрозуміли»). It classified every nav section as `phone` or `desktop`, grouped the narrow menu
 * under **On this phone** / **On desktop**, tagged the desktop rows, and rendered an explainer
 * instead of the content on seven routes and four Settings tabs.
 *
 * It was a good model for a product that no longer exists. Baseout below 1280 is not a phone
 * product; it is the SAME product in an Airtable extension panel, driven by a cursor, at a width
 * the user chooses by dragging. Every section was unwalled on 2026-08-11 and the classification has
 * read `phone` for all eleven items ever since — which meant the menu printed one heading,
 * **On this phone**, over the entire product, and a second, empty group under it. A grouping with
 * one group is not a grouping; it is a label that says something untrue about where you are.
 *
 * DELETED WITH IT, because each existed only to serve the wall: `mobileNavGroups`, `surfaceOf`,
 * `isDesktopOnly`, `desktopOnlyCopy` and its seven copy blocks, `settingsTabSurface`,
 * `settingsTabCopy` and its four, `DesktopOnlyNotice.astro`, the `data-desktop-only` /
 * `data-narrow-gated` CSS, the `NavItem.surface` field in `app-config.json`, and the `bo_vw`
 * cookie architecture — whose entire purpose was to avoid serving 10 MB of `/schema` to a client
 * that was about to be shown one paragraph instead. Nothing is shown one paragraph now.
 *
 * What remains is a number and the two ways to ask about it. `MOBILE_BREAKPOINT` is authored HERE
 * and nowhere else: `MOBILE_MAX` and `MOBILE_MEDIA` derive from it, every JS consumer imports it,
 * the two inline shell scripts receive it through `define:vars` because they cannot import, and CSS
 * mirrors it in exactly one spelling — `@media (max-width: 1279.98px)` — which `ds-checks.mjs`
 * enforces. Four spellings coexisted the day before that rule (`innerWidth < 1024`, `1023.98px`,
 * `1279.98px`, `innerWidth < 1280`), and a stale `innerWidth < 900` default once gave the Schema
 * panel 124px in which its CSS said mobile and its controller said desktop.
 */
/**
 * THE boundary, and the only place it is written down. At or above this width you get the full
 * tool with its pinned sidebar; below it, the reading product in the phone chrome.
 */
export const MOBILE_BREAKPOINT = 1280;

/**
 * ── THE FLOOR: 390 (Oleh, 2026-08-11) ─────────────────────────────────────────────────────────
 * The narrowest width this interface is built to work at, chosen to clear the iPhone sizes. Below
 * it the app stops pretending and says so, over everything, rather than degrading silently.
 *
 * IT IS A FLOOR, NOT A SECOND PRODUCT LINE — the difference from 1280 matters. 1280 changes the
 * CHROME (the sidebar becomes a drawer). Each surface then collapses at ITS OWN measured width
 * (the Schema tree at 900, from a min-content of 897). 390 is where collapsing stops being
 * possible at all.
 *
 * Inside Airtable's extension panel we never draw this: the Blocks SDK takes a declared
 * `ViewportConstraint minSize` and shows its own overlay. This is for the browser window and the
 * Chrome extension, where nobody enforces a minimum for us.
 */
export const MIN_WIDTH = 390;
export const TOO_NARROW_MEDIA = `(max-width: ${MIN_WIDTH - 0.02}px)`;

/**
 * The same boundary in the `.98` form the CSS ladder settled on, DERIVED rather than retyped —
 * two numbers that must agree are two numbers that can disagree.
 */
export const MOBILE_MAX = MOBILE_BREAKPOINT - 0.02;

/** The one media-query string. Every `matchMedia` in the app reads this; none writes a literal. */
export const MOBILE_MEDIA = `(max-width: ${MOBILE_MAX}px)`;

/**
 * Is this viewport the phone product? Browser-only — the server has no viewport, which is the whole
 * reason the `bo_vw` cookie exists (see SidebarLayout.astro's frontmatter).
 */
export function isNarrow(): boolean {
  return window.matchMedia(MOBILE_MEDIA).matches;
}

/**
 * Minimum tap target below the boundary. 44px, and the reason is written down because a number
 * without one drifts: Apple HIG specifies 44pt exactly, WCAG 2.2 SC 2.5.5 (AAA) specifies 44×44 CSS
 * px, and 44 is on this app's 4px spacing grid. Material's 48dp is the other candidate; 44 wins
 * because it satisfies both cited standards, is 9% denser, and density is the house style.
 *
 * This governs the BOX, never the type. The SM/12px floor is a type rule and is untouched — a
 * `btn-sm` in the mobile shell keeps its 12px label and grows its box to 44px.
 */
export const TOUCH_MIN = 44;
