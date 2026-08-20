/**
 * listSheet — ONE mechanism for "a left list that stops being a column and becomes an overlay".
 *
 * THE PROBLEM, three times over. Docs, Chat and Data ▸ Records are all two-part consoles: a left
 * LIST (documents / threads / presets) beside the thing you came for (a document / a conversation /
 * the grid). At a narrow section the list holds a third of the width nobody is reading, and the
 * content it starves is unusable — Oleh's screenshot has the doc title "Contacts dataset" broken
 * into `Cont` / `acts`, one word per line, with the editor's formatting toolbar stacked into a
 * vertical strip. Each console's only escape was a toggle that hid the list outright, so the choice
 * was "cripple the content" or "lose the list". Both are bad answers to the same question.
 *
 * THE ANSWER (Oleh, reference: the Claude desktop app). Below a threshold the list stops being a
 * column, the content takes the whole width, and the SAME toggle opens the list as a left-anchored
 * SHEET over the content, dimmed behind, with nothing underneath reflowing. Picking closes it.
 *
 * WHY THIS FILE EXISTS AT ALL. Three hand-rolled overlays would drift apart inside a fortnight —
 * this repo spent last week collapsing five copies of one glyph map and four copies of one pager
 * back into single components. So the geometry, the mode decision, the open/close/Escape/dim/focus
 * wiring and the toggle's dual meaning all live here once; a console supplies selectors and copy.
 *
 * TWO STATE BITS, deliberately separate:
 *   `is-list-overlay`  — the MODE. Written only by this module, from the section width.
 *   `is-list-open`     — the transient "the sheet is showing". Written only by open/close.
 * A console's pre-existing WIDE-mode hide (`dc-list-collapsed`, `is-rail-collapsed`,
 * `data-collapsed="1"`) is left exactly as it was: it answers a question that only exists while the
 * list is a column, and above the threshold every behaviour here is byte-for-byte what it was.
 */

import { pushEscape } from './escapeStack';

/**
 * ── THERE IS NO LONGER A `964` HERE (O2, 2026-08-14) ──────────────────────────────────────────
 *
 * There used to be: `const OVERLAY_BELOW = 964`, compared against the section column. It was
 * hand-derived in the browser on 2026-08-06 and written down as a sum:
 *
 *   reading column floor .. 377px  = 45ch of the editor's 14px Urbanist — the shortest measure that
 *                                    still reads as prose. It is the BINDING constraint: the
 *                                    formatting toolbar needs 335px unwrapped and the longest doc
 *                                    title needs 182px, so prose is what runs out last.
 *   + .dc-main padding ..... 48px  (24 + 24)
 *   + meta rail ............ 240px (--rail-s; it stays BESIDE the text down to the 1280 tier)
 *   + .dc-pane borders ....... 2px
 *   = document surface ..... 667px
 *   + list rail ............ 280px (--rail-m)  + 16px gap
 *   = 963px, taken up to 964 to sit on the 4px grid.
 *
 * FIRST, WHAT WAS *NOT* WRONG WITH IT, because it was reported as the same defect ruling 7 fixed in
 * `toolbarFit.ts` and it is not. `toolbarFit`'s `NARROW_AT = 1440` was in the wrong UNITS — a
 * viewport ladder compared against a column that is always ~256px smaller, so it could never
 * evaluate false and `data-narrow` was the only state the toolbar ever had. `964` is already in
 * COLUMN units: every term above is a column term, and it does toggle. Measured through an iframe
 * harness on 2026-08-14, `/schema?tab=docs`: at a 1440 viewport the section column is 1121 and
 * `is-list-overlay` is correctly ABSENT (the document surface gets 825px, far above its 667 floor);
 * at 900 the column is 861 and `is-list-overlay` is correctly PRESENT. A scout who only ever looks
 * at 1440 will conclude the sheet does not exist, but that is the scout's sampling, not a bug — at
 * 1440 this console SHOULD be two columns.
 *
 * WHAT WAS ACTUALLY WRONG: the sum was evaluated once, by hand, and then frozen. Three of its five
 * terms are live values the app can be asked for — `--rail-m`, `--rail-s`, and the shell's own
 * `column-gap` — and the first time any of them moves, `964` becomes a number that describes a
 * layout the app no longer has, silently, with every gate green. That is the durable half of ruling
 * 7's lesson: a threshold must be re-derived from what is rendered, not remembered.
 *
 * So the sum stays (it is the right sum) and it is now COMPUTED, per pass, from the values it was
 * always about. Two literals survive, and both are statements about the reading surface rather than
 * guesses about a window: `PROSE_CH` (45 characters is the shortest line that still reads as prose,
 * and `ch` is measured in the console's own type, so a font change carries through) and
 * `SURFACE_CHROME` (the reading pane's own padding and borders).
 *
 * WHAT IS STILL NOT MEASURED, stated so nobody thinks it is: the honest version asks the reading
 * surface directly — "are you below your floor?" — instead of reconstructing its width from parts.
 * That is not reachable from this module, because `ListSheetHost` carries no selector for the
 * reading surface; it names the toggle, the dim, the pick target and the first list item, and that
 * is all. Adding `content: string` to the interface and one selector to each of the three consoles
 * is the change that would finish this, and it is a change to files this module does not own.
 *
 * ONE ANSWER PER SECTION, and now enforced rather than assumed. It used to be true only because all
 * three consoles shared one literal; the moment the threshold is derived per console it stops being
 * automatic, so `decide()` computes every console in a section and OR-s them, exactly as
 * `toolbarFit.restamp` does. Chat's own floor is ~778px and Records' is lower still, but two tabs of
 * one section at one width must give one answer — the defect Oleh reported on 2026-08-06 was exactly
 * a control that changed shape between neighbouring tabs ("якщо тут коротка кнопка з іконкою,
 * значить всюди").
 */
/** The shortest line that still reads as prose, in characters of the console's own type. */
const PROSE_CH = 45;
/** The reading pane's own horizontal padding (24 + 24) and its container's borders (1 + 1). */
const SURFACE_CHROME = 50;

function px(v: string, fallback: number): number {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** `45ch` in the console's own type — measured, so a font or size change carries through. */
function proseFloor(root: HTMLElement): number {
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${PROSE_CH}ch`;
  root.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  // 8.38px/ch is the 14px Urbanist this was derived against; the fallback only matters if the probe
  // is measured inside a `display:none` tab, where it reports 0.
  return w > 0 ? w : PROSE_CH * 8.38;
}

/**
 * The column width below which this console's list can no longer be a column beside its content.
 *
 * Recomputed per pass rather than cached: the inputs are three computed styles and one probe span,
 * and the whole point of this rewrite is that a stale answer is the failure mode being fixed.
 */
function threshold(h: ListSheetHost): number {
  const root = h.root;
  const cs = getComputedStyle(root);
  const listRail = px(cs.getPropertyValue('--rail-m'), 280);
  const metaRail = px(cs.getPropertyValue('--rail-s'), 240);
  // The shell is the dim's offset parent in all three consoles — the dim is `position: absolute;
  // inset: 0` inside it, which is what makes it the dim. No new host selector is needed for this.
  const shell = root.querySelector<HTMLElement>(h.dim)?.parentElement;
  const gap = shell ? px(getComputedStyle(shell).columnGap, 16) : 16;
  return listRail + gap + metaRail + surfaceChrome(h) + proseFloor(root);
}

/**
 * The reading surface's own horizontal chrome — padding plus borders — MEASURED when the host names
 * the surface, and the stated constant when it does not.
 *
 * This is the last term in `threshold()` that used to be asserted. It is measured for the same
 * reason `proseFloor` is: the recorded value of the OTHER asserted term had drifted 377 → 430px
 * before anyone re-derived it, and nothing could have caught that, because a frozen number is
 * exactly as green as a correct one.
 */
function surfaceChrome(h: ListSheetHost): number {
  if (!h.content) return SURFACE_CHROME;
  const el = h.root.querySelector<HTMLElement>(h.content);
  if (!el) return SURFACE_CHROME;
  const cs = getComputedStyle(el);
  const sum =
    px(cs.paddingLeft, 0) + px(cs.paddingRight, 0) +
    px(cs.borderLeftWidth, 0) + px(cs.borderRightWidth, 0);
  // A pane measured inside a `display:none` tab reports 0 for every box value; the constant is the
  // honest answer there, not a zero that would make the threshold too small and stamp "wide".
  return sum > 0 ? sum : SURFACE_CHROME;
}

/**
 * The measurement is the SECTION's content column minus its own padding — i.e. exactly the width a
 * console gets. NOT the viewport: split view changes this column without touching the window, which
 * is what broke the `@media` rules `toolbarFit.ts` replaced. And NOT the host element either: every
 * tab panel is in the DOM at once and only one is painted, so a hidden host measures 0 and would be
 * stamped "narrow" on a wide screen, then have to correct itself mid-paint on the tab switch. The
 * column is always painted.
 */
function available(el: Element): number {
  const col = (el.closest('#layout-content') as HTMLElement | null) || (el.closest('main') as HTMLElement | null);
  if (!col) return (el as HTMLElement).clientWidth;
  const cs = getComputedStyle(col);
  return col.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
}

export interface ListSheetHost {
  /** The element that carries `is-list-overlay` / `is-list-open`. */
  root: HTMLElement;
  /** The toggle button, re-queried on every use — Data re-renders its pin-bar, so the node changes. */
  toggle: string;
  /** Optional icon span inside the toggle whose Lucide class flips with the state. */
  icon?: string;
  /** Click inside this (within root) closes the sheet — the dim. */
  dim: string;
  /** Click inside this (within root) is a PICK: it closes the sheet. */
  pick: string;
  /** Focused when the sheet opens. First match wins, so put the active row first. */
  firstItem: string;
  /**
   * The READING SURFACE — the pane the list sits beside. Optional, and supplying it is what makes
   * the threshold honest: with it, the surface's own horizontal chrome is MEASURED off its computed
   * style instead of being asserted as `SURFACE_CHROME`. Without it the constant is used and the
   * fallback is stated rather than hidden.
   *
   * Why this matters here specifically: this module's whole rewrite exists because a sum was
   * computed once by hand and frozen, and by the time anyone re-derived it, `45ch` had grown from
   * the recorded 377px to 430px — a threshold 52px wrong, with every gate green. `SURFACE_CHROME`
   * is the last term still asserted rather than read, so it is the last one that can drift the same
   * way the moment a pane's padding changes.
   */
  content?: string;
  /** Is the list hidden by the WIDE-mode preference? */
  wideHidden: () => boolean;
  /** Flip the WIDE-mode preference (only ever called above the threshold). */
  setWideHidden: (hidden: boolean) => void;
  /** Tooltip + aria copy. `hide`/`show` are the column meanings, `choose`/`close` the sheet ones. */
  labels: { hide: string; show: string; choose: string; close: string };
  /**
   * Consoles that RE-RENDER their toggle (Data) supply this instead of letting us set attributes on
   * a node that is about to be replaced. It must redraw the toggle from `is-list-overlay` /
   * `is-list-open` / the wide preference.
   */
  syncToggle?: () => void;
}

const hosts: ListSheetHost[] = [];
const observed = new WeakSet<Element>();

function isOverlay(h: ListSheetHost) { return h.root.classList.contains('is-list-overlay'); }
function isOpen(h: ListSheetHost) { return h.root.classList.contains('is-list-open'); }

/** Which label does the toggle carry right now, and is the list showing? */
function toggleState(h: ListSheetHost): { showing: boolean; label: string } {
  if (isOverlay(h)) return isOpen(h) ? { showing: true, label: h.labels.close } : { showing: false, label: h.labels.choose };
  return h.wideHidden() ? { showing: false, label: h.labels.show } : { showing: true, label: h.labels.hide };
}

/**
 * The toggle is ONE button with TWO jobs, so it must say which one is live. daisyUI `data-tip`,
 * never a native `title=` — the old Docs handler set `.title` in JS, which no gate could see.
 */
function syncToggle(h: ListSheetHost) {
  if (h.syncToggle) { h.syncToggle(); return; }
  const { showing, label } = toggleState(h);
  const btn = h.root.querySelector<HTMLElement>(h.toggle);
  if (h.icon) {
    const ic = h.root.querySelector<HTMLElement>(h.icon);
    if (ic) ic.className = `iconify size-4 ${showing ? 'lucide--panel-left-close' : 'lucide--panel-left-open'}`;
  }
  if (!btn) return;
  btn.setAttribute('data-tip', label);
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-expanded', showing ? 'true' : 'false');
}

/** The current toggle label — for a console that renders its own button. */
export function listSheetToggleLabel(root: HTMLElement, labels: ListSheetHost['labels'], wideHidden: boolean): { showing: boolean; label: string } {
  const overlay = root.classList.contains('is-list-overlay');
  const open = root.classList.contains('is-list-open');
  if (overlay) return open ? { showing: true, label: labels.close } : { showing: false, label: labels.choose };
  return wideHidden ? { showing: false, label: labels.show } : { showing: true, label: labels.hide };
}

function open(h: ListSheetHost) {
  h.root.classList.add('is-list-open');
  syncToggle(h);
  h.root.querySelector<HTMLElement>(h.firstItem)?.focus();
}

function close(h: ListSheetHost) {
  if (!isOpen(h)) return;
  h.root.classList.remove('is-list-open');
  syncToggle(h);
  // A widen that arrived while the sheet was open was deliberately deferred — land it now.
  decide(h);
  h.root.querySelector<HTMLElement>(h.toggle)?.focus();
}

function sectionOf(el: Element): HTMLElement | null {
  return (el.closest('#layout-content') as HTMLElement | null) || (el.closest('main') as HTMLElement | null);
}

/** Stamp one console with an answer the whole section already agreed on. */
function stamp(h: ListSheetHost, overlay: boolean) {
  // Widening while the sheet is OPEN must not reflow under the user's hand: they are pointing at a
  // row, and turning the sheet back into a column moves that row out from under the pointer. That is
  // the defect `decision-panels-overlay-not-reflow` exists to prevent. `close()` re-runs this.
  if (!overlay && isOpen(h)) return;
  const was = isOverlay(h);
  h.root.classList.toggle('is-list-overlay', overlay);
  if (!overlay) h.root.classList.remove('is-list-open');
  if (was !== overlay) syncToggle(h);
}

/**
 * One pass over a section: ask every console in it whether its list still fits as a column, OR the
 * answers, stamp them all alike. A hidden tab measures 0 and casts no vote, but it still takes the
 * section's answer — so revealing it shows a console that already agrees with its neighbours instead
 * of correcting itself mid-paint. (`toolbarFit.restamp` does the same thing for the same reason.)
 */
function decideSection(col: HTMLElement) {
  const mine = hosts.filter((h) => sectionOf(h.root) === col);
  if (!mine.length) return;
  const w = available(mine[0].root);
  if (w <= 0) return; // unknown, not narrow — leave the last answer alone
  const overlay = mine.some((h) => h.root.clientWidth > 0 && w < threshold(h));
  mine.forEach((h) => stamp(h, overlay));
}

function decide(h: ListSheetHost) {
  const col = sectionOf(h.root);
  if (col) decideSection(col);
  else if (available(h.root) > 0) stamp(h, available(h.root) < threshold(h));
}

/** Re-decide every wired console. Exported for hosts that change their own width. */
export function refreshListSheets(): void {
  const cols = new Set<HTMLElement>();
  hosts.forEach((h) => { const c = sectionOf(h.root); if (c) cols.add(c); else decide(h); });
  cols.forEach(decideSection);
}

/**
 * Wire one console. Idempotent per root. Returns the imperative handles a host may need (Data
 * closes the sheet from its own preset-pick path, which is not a plain click inside `pick`).
 */
export function wireListSheet(h: ListSheetHost): { open: () => void; close: () => void } {
  const handles = { open: () => open(h), close: () => close(h) };
  if (h.root.dataset.listSheetWired) return handles;
  h.root.dataset.listSheetWired = '1';
  hosts.push(h);

  h.root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest(h.dim)) { close(h); return; }
    if (t.closest(h.toggle)) {
      if (isOverlay(h)) { isOpen(h) ? close(h) : open(h); return; }
      const hidden = !h.wideHidden();
      h.setWideHidden(hidden);
      syncToggle(h);
      return;
    }
    // Picking is the end of the errand — you opened the sheet to choose, and you chose.
    if (t.closest(h.pick)) close(h);
  });

  // Escape closes the sheet. This used to be a bare `document` keydown, and it once carried a
  // `stopPropagation()` that read like a guarantee and did nothing: listeners on the SAME target
  // cannot stop each other, so a dozen other `document` Escape handlers ran on every press anyway.
  // The convergence this file used to defer is DONE — `lib/escapeStack.ts` owns the single document
  // listener and walks its handlers LIFO, so exactly one surface answers a press. Our part of the
  // contract is the honest `false`: a closed sheet must let the key fall through to what is beneath.
  pushEscape({
    label: 'listSheet',
    onEscape: () => {
      if (!isOpen(h)) return false;
      close(h);
      return true;
    },
  });

  // One observer per section column, re-deciding every console in it together — including the
  // hidden tabs, so a tab switch reveals a console that already agrees with its neighbours.
  const col = (h.root.closest('#layout-content') as HTMLElement | null) || (h.root.closest('main') as HTMLElement | null);
  if (col && !observed.has(col)) {
    observed.add(col);
    let queued = 0;
    new ResizeObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => { queued = 0; refreshListSheets(); });
    }).observe(col);
  }

  decide(h);
  syncToggle(h);
  return handles;
}
