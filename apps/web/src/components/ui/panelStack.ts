/**
 * panelStack — the ONE stacking multi-panel drawer controller (catalog `pattern-multi-panel-drawer`).
 *
 * Extracted 2026-07-22 from three hand-copied controllers (Schema EntityPanel `.ep-*`, Data RecordPanel
 * `.rp-*`, Data Changelog drill `.dcp-*`) that had drifted (different constants, duplicated 46px strip
 * literal + magic numbers). This owns the CONTENT-AGNOSTIC stack mechanics — the panel array, per-panel
 * width/anchor/focus/collapse, auto-accordion layout, per-panel resize grip, stack shutter, reorder,
 * park/expand, cap-with-undo, mobile fold — and calls back into the host for everything DOM/content
 * specific (cloning a panel, rendering it, keying it for dedup, showing a toast, flashing a new panel).
 *
 * A host panel object must extend `StackPanel` (el + the six stack-managed fields); everything else on it
 * (body refs, per-panel view state) is the host's own and the controller never touches it.
 */
import { MOBILE_MEDIA } from '../../lib/mobileNav';

/** The minimum shape the controller manages on every panel; hosts extend this with their own fields. */
export interface StackPanel {
  el: HTMLElement;
  /** Stable id for this panel instance (not the content id). */
  uid: number;
  /** The anchor is slot-0, created by a plain open; it never reorders and is never the eviction victim. */
  anchor: boolean;
  /** Stored expanded width in px (what the panel returns to when un-parked). */
  w: number;
  /** Focus recency — higher = more recently focused; drives which panel the accordion parks first. */
  seq: number;
  /** Parked to a slim strip. */
  collapsed: boolean;
  /** What had DOM focus when this panel was opened, so closing it can give the keyboard back.
   *  Set by the controller in `createPanel`; hosts never touch it. Held as a live element rather
   *  than a selector because the thing that opened a panel is usually a row in a virtualised list
   *  and has no stable address — `restoreFocus` re-checks `isConnected` before using it. */
  opener?: HTMLElement | null;
  /** True when the AUTO-ACCORDION parked this panel, false/absent when the USER did (per-panel park,
   *  Collapse all, or a shutter drag past the floor). The two are indistinguishable once `collapsed`
   *  is set, and they must not be: leaving split view has to give back the strips the MODE made and
   *  leave the ones the user made alone. Set only in `layout()`; cleared by every explicit act. */
  autoParked?: boolean;
}

export interface ToastAction { label: string; run: () => void; icon?: string; }

export interface PanelStackConfig<P extends StackPanel> {
  /** Root drawer element (hidden when the stack is empty). */
  root: HTMLElement;
  /** The flex row that holds the panels in DOM order (array[0] = anchor = leftmost). */
  panelsEl: HTMLElement;
  /** The stack's control column (＋ picker + bulk verbs + shutter + count); hidden when the stack is empty. */
  railEl: HTMLElement;
  /** Optional open-panel count badge on the rail. */
  countEl?: HTMLElement | null;
  /** The stack shutter pill (drag / ←→ to resize every expanded panel together). */
  shutterEl?: HTMLElement | null;
  /** Optional SECOND drag surface for the same stack-resize gesture: the control column's whole
   *  background. Same handler as the shutter, one guard — a pointerdown that started on a control
   *  never begins a drag (`resizeIgnoreSel`, matched with `closest` on the event TARGET, not on
   *  coordinates). The shutter pill stays: it is the visible "draggable" cue and the ←/→ keyboard
   *  route, neither of which a bare background can be. */
  resizeEl?: HTMLElement | null;
  /** What inside `resizeEl` must never start a drag. Defaults to every interactive element. */
  resizeIgnoreSel?: string;

  /** Stack geometry. Only MINW, TABLEGAP and MINCONTENT are genuinely per-surface (records want a wider
   *  floor; a page reserves more/less peek to the left of the drawer, and keeps more/less of itself
   *  readable once the panels take width for real); the rest are shared INVARIANTS with sensible
   *  defaults, so a host overrides one only with a reason. STRIP = parked-strip width (a bare `46` in
   *  every old copy). MINEXP defaults to MINW (the promise "N panels fit expanded side by side").
   *  MINW is the STACK-level floor — the seed for `minwOf` below and the sanity bound on a remembered
   *  width; every per-panel floor question goes through `minwOf`. */
  DEFW?: number; MINW?: number; TABLEGAP?: number; MAXPANELS?: number; MINEXP?: number; COLLAPSE_AT?: number;
  /** SPLIT ONLY: the width the PAGE CONTENT keeps, always. `TABLEGAP` is the same idea in overlay
   *  mode, but there it only has to leave a sliver of peek because panels float above the listing;
   *  in split they take the width for real, so the reserve becomes a readable minimum instead of a
   *  hint. Stated as CONTENT — the control column is measured and added on top, so this number never
   *  has to be kept in sync with the rail's own width. PER-SECTION, and for the same reason TABLEGAP
   *  is: it is a claim about how much of THIS page has to stay readable, and the pages are different
   *  shapes. The host ferries it as `data-ph-mincontent` (see `PanelHost.astro`). */
  MINCONTENT?: number;
  /** sessionStorage key under which this SECTION remembers its open panels. Omit and the stack keeps
   *  no memory at all. */
  sessionKey?: string;

  /** Is the stack in split mode right now? Drives which reserve applies and whether space caps the
   *  panel count at all. Defaults to false, so a host that never splits is unaffected. */
  isSplit?: () => boolean;
  STRIP?: number;
  /** PER-PANEL minimum expanded width. `MINW` is one number for the whole stack, which only works while
   *  a stack holds one KIND of sheet. It does not: the schema entity sheet has an argued 320 floor
   *  (4 × 320 + 110 of table peek = 1390, so four fit expanded on a 1440 laptop) while records, runs
   *  and files sit on the shared 360. When one host holds all four kinds, the floor has to be a
   *  question asked of the PANEL, not a constant of the stack. Defaults to `() => MINW`, so a
   *  single-kind host that passes nothing keeps exactly the arithmetic it had. */
  minwOf?: (p: P) => number;
  /** The per-panel width CSS custom property. One name app-wide: `--panel-w`. */
  widthVar: string;
  /** Prefix-specific class names toggled on panel elements. */
  cls: {
    collapsed: string; focus: string; anchor: string; flash: string; atLimit: string;
    gripOn: string; dragging: string; reordering: string;
  };
  /** Reorder-grip selector (delegated pointerdown); a panel is `[data-…-panel]`. */
  reorderSel: string;
  /** How to find a SHEET from a descendant. One handle app-wide — `[data-ps-panel]` — stamped on every
   *  sheet template beside its own `data-{prefix}-panel` hook (those stay: other code and CSS use
   *  them). A single host can only pass ONE selector, and it has to match every kind it holds.
   *  NOT `data-panel`: that name is already the section-TAB panel handle (`ui/sectionTabs.ts`, every
   *  `.sch-panel[data-panel="browse|changelog|…"]`), and a drawer sheet renders INSIDE one of those —
   *  reusing it would have let the tab controller enumerate open drawer sheets as tab panels. */
  panelSel: string;
  /** Per-panel resize-grip selector (the full-height left edge line), resolved within each panel. */
  gripSel: string;

  /** Is the viewport in single-panel (mobile) mode? Defaults to `matchMedia(MOBILE_MEDIA)` — the one product boundary. */
  isMobile?: () => boolean;

  /** The width the stack is allowed to budget against, BEFORE the reserve.
   *
   *  This used to be a hard `window.innerWidth`, which is a lie on every page that has a left
   *  navigation: at a 1440 viewport the stack believed it had 1376px while the work column was
   *  1136 — a 256px overcount. Invisible while the stack OVERLAYS (panels simply cover more of the
   *  page than the arithmetic thought), fatal in split view, where a panel would claim room that
   *  does not exist. Pass the work column and the budget becomes container-relative.
   *
   *  Measure the element's BORDER-box width: split pushes the content in with `padding-right`,
   *  which does not change that number, so the measurement can never chase its own output.
   *  Defaults to `window.innerWidth` — a host that passes nothing keeps the old numbers. */
  containerW?: () => number;

  /** Hard ceiling on how many panels may be EXPANDED at once, independent of whether they fit.
   *  Split view caps at 1 (2 on a big screen); overlay passes nothing and is capped only by the
   *  budget. Overflow parks to the existing 46px strips — there is no second mechanism. */

  // ── Host hooks ──
  /** Clone the template + wire the panel's own DOM refs/state; return the panel. uid/seq/w/anchor/collapsed
   *  are filled by the controller right after, so the host may pass placeholders.
   *
   *  `id` is the KIND-PREFIXED content id this panel is about to hold (`base:` `table:` `field:` `view:`
   *  `space:` `record:` `run:` `asset:`). A single-kind host ignores it — `() => P` is assignable to
   *  `(id: string) => P`, so every existing call site stays valid. A MULTI-KIND host needs it: it is the
   *  only thing available at clone time that says WHICH template to clone and which controller to
   *  instantiate, and cloning has to happen before `loadInto` can run. Additive on purpose. */
  buildPanel: (id: string) => P;
  /** Point an existing panel at a new content id (reset the host's per-panel view state). */
  loadInto: (p: P, id: string) => void;
  /** Render a panel's body/header. */
  render: (p: P) => void;
  /** The content key used to dedup an open (usually the top-of-stack id; return '' to never dedup). */
  panelKey: (p: P) => string;
  /** Optional: reject an open (e.g. record not in this backup). Return false to abort; pair with onMissing. */
  canOpen?: (id: string) => boolean;
  onMissing?: (id: string) => void;
  /** Mobile open-beside: hosts drill in place instead of spawning a panel. */
  mobileOpen?: (p: P | null, id: string) => void;
  /** Called for every panel whenever focus changes (host may drive a per-panel active flag, e.g. the
   *  Schema EntityPanel routes keyboard shortcuts to `panel.setActive`). Runs after the focus class toggle. */
  onFocus?: (p: P, isFocused: boolean) => void;
  /** Called right before a panel's element is removed (close / evict / closeAll) so a host with a rich
   *  per-panel controller can tear it down (unbind listeners) — the Schema EntityPanel's `panel.doClose`. */
  onDestroy?: (p: P) => void;

  /** Show a toast; the host owns the toast DOM + copy. `null` action = an info toast. */
  toast: (label: string, action: ToastAction | null, ms?: number) => void;
  /** Hide any toast. */
  hideToast: () => void;
  /** Undo/info copy (host owns wording). */
  text: { closed: string; capReached: (max: number) => string; evicted: (max: number) => string; evictedForRoom: (n: number) => string; detached?: string; closedAll?: (n: number) => string; };
  /** Called at the end of every `layout()` — for chrome that mirrors the stack's size (e.g. a bulk
   *  verb's tooltip naming how many panels it acts on). Read-only by contract: do not re-enter the API. */
  onLayout?: () => void;
  /** Optional flash animation for a freshly-opened non-anchor panel. */
  flash?: (el: HTMLElement) => void;
  /** Optional cleanup when the stack empties (e.g. close a ＋ picker popover). */
  onEmpty?: () => void;
}

export interface PanelStackApi<P extends StackPanel> {
  panels: () => P[];
  focused: () => P | null;
  anchorOf: () => P | null;
  byUid: (uid: number) => P | null;
  open: (id: string, init?: (p: P) => void) => void;
  openBeside: (source: P | null, id: string, init?: (p: P) => void) => void;
  /** Low-level: create a panel (host openFieldBeside-style flows). */
  createPanel: (id: string, anchor: boolean, init?: (p: P) => void) => P;
  closePanel: (p: P) => void;
  /** Tear down every panel at once, silently (host Esc-on-anchor / tab change). No toast — the user
   *  did not ask for this, the context did, so there is nothing to offer undoing. */
  closeAll: () => void;
  /** The USER-facing "Close all": same teardown, but it offers an Undo that restores every panel it
   *  closed, in order. Destructive bulk verbs must be recoverable; `closeAll` is not that verb. */
  closeAllWithUndo: () => void;
  expandAll: () => void;
  allCollapsed: () => boolean;
  /** Park every panel to a strip. One line by design — see the comment at the implementation. */
  collapseAll: () => void;
  detachPanel: (p: P) => void;
  parkPanel: (uid: number) => void;
  expandPanel: (uid: number) => void;
  evictLRU: (announce?: boolean) => void;
  layout: () => void;
  setFocus: (p: P | null) => void;
  atCap: () => boolean;
  /** Close LRU panels until the split content floor is honoured. Returns how many closed. */
  evictForRoom: (headroom?: number) => number;
  /** Toast whatever `evictForRoom` returned. Kept separate so the caller controls message order. */
  announceEviction: (n: number) => void;
  /** How many panels the current mode + width allow. */
  spaceCap: () => number;
  /** Un-park every strip the auto-accordion made (never one the user made). Returns how many came
   *  back. Called when leaving a mode that took width away. */
  unparkAuto: () => number;
  /** Write the open arrangement to sessionStorage. Wired to `pagehide` automatically. */
  saveSession: () => void;
  /** Rebuild the last arrangement, last-focused panel expanded. Returns how many saved panels are
   *  still MISSING — 0 means done, anything else means a kind has yet to register. */
  restoreSession: () => number;
  /** Re-run the last close as an undo (host wires this into its undo toast action). */
  reopenLastClosed: () => void;
}

export function createPanelStack<P extends StackPanel>(cfg: PanelStackConfig<P>): PanelStackApi<P> {
  // Shared invariants default here; a host passes only what is genuinely its own (usually MINW + TABLEGAP).
  const STRIP = cfg.STRIP ?? 46;
  const DEFW = cfg.DEFW ?? 480;
  const MINW = cfg.MINW ?? 360;
  const TABLEGAP = cfg.TABLEGAP ?? 64;
  const MINCONTENT = cfg.MINCONTENT ?? 700;
  const isSplitNow = cfg.isSplit ?? (() => false);
  /** MEASURED, never restated: the control column is 40px in CSS and writing 40 here again is the
   *  exact two-places-one-number trap that produced three defects this week. */
  const railW = () => (railEl && !railEl.hidden ? railEl.getBoundingClientRect().width : 0);
  /** What the stack must leave behind. Overlay: a sliver of peek (`TABLEGAP`, which already absorbs
   *  the control column). Split: a readable listing plus that column. */
  const reserve = () => (isSplitNow() ? railW() + MINCONTENT : TABLEGAP);
  const MAXPANELS = cfg.MAXPANELS ?? 10;
  // Every floor question is now asked of a PANEL. `minwOf` defaults to the scalar, and `minexpOf`
  // (how much room a panel needs to COUNT as expanded) defaults to that panel's own floor — so a
  // host that passes neither computes byte-identical numbers to the pre-hook code.
  const minwOf = cfg.minwOf ?? (() => MINW);
  const minexpOf = (p: P) => cfg.MINEXP ?? minwOf(p);
  /** The widest floor in the stack — for the two stack-TOTAL clamps that have no single panel in hand. */
  const maxMinw = () => (panels.length ? Math.max(...panels.map(minwOf)) : MINW);
  const COLLAPSE_AT = cfg.COLLAPSE_AT ?? 300;
  // The CSS single-column breakpoint, IMPORTED rather than retyped: the controller and the
  // stylesheet must agree, and a literal here is how they came to disagree by 256px. It is the one
  // product boundary now (lib/mobileNav.ts) — below it panels take the full width, because below it
  // the chrome is the phone chrome.
  const isMobile = cfg.isMobile ?? (() => window.matchMedia(MOBILE_MEDIA).matches);
  /** The ONE reader of "how wide is the world" — see `containerW` on the config. */
  const containerW = cfg.containerW ?? (() => window.innerWidth);
  const { root, panelsEl, railEl, cls } = cfg;

  let panels: P[] = [];
  let focused: P | null = null;
  let uidSeq = 1, focusSeq = 1;
  let lastClosed: { id: string; anchor: boolean } | null = null;

  /** The width a panel is BORN with, and returns to whenever it un-parks. A constant on purpose.
   *  It used to be a remembered preference — persisted to localStorage and re-learned from the last
   *  drag — so one afternoon of widening a panel made every panel afterwards open wide, across
   *  reloads, with nothing on screen saying why (Oleh, 2026-08-05: "вона іноді є дуже широкою…
   *  зберігає мій стан з попередньої роботи"). Widening is now a LIVE gesture that belongs to the
   *  panel you are dragging and to nothing else. */
  const defW = DEFW;

  // ── FOCUS (D45 item 1) ────────────────────────────────────────────────────────────────────────
  // Before this, `focused` was a CSS class and a z-order and nothing else: there were ZERO `.focus()`
  // calls in this file or in `PanelHost.astro`. Measured on /schema at 1440, 2026-08-14 — Tab to a
  // base row, Enter, and the panel opens with `document.activeElement` still on the row BEHIND it;
  // two Tabs walk `button.br-twist` then the next row, both underneath the open sheet; Escape then
  // closes a panel the keyboard never reached and leaves focus on whatever row it had wandered to,
  // not on the one that opened it. The overlay was, to a keyboard, invisible.
  //
  // WHY THE PANEL ELEMENT AND NOT ITS CLOSE BUTTON. D45 says "close button or first heading". The
  // sheet itself, with `tabindex="-1"`, is better than either and is what WAI-ARIA's dialog pattern
  // recommends: a screen reader announces the panel's own label instead of the word "Close", and the
  // very first Tab still lands on the first real control. Landing ON the close button means Enter —
  // the key that just opened the thing — closes it again.
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]),' +
    ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary, [contenteditable=""], [contenteditable="true"]';

  /** Visible, focusable descendants of a panel, in DOM order. `offsetParent` is the cheap visibility
   *  test that also excludes a PARKED strip's contents and anything a host has hidden. */
  const focusablesIn = (el: HTMLElement): HTMLElement[] =>
    [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (n) => n.offsetParent !== null && !n.hasAttribute('inert') && n.getAttribute('aria-hidden') !== 'true',
    );

  /** Move DOM focus INTO a panel. Called only when a panel is genuinely opened or re-opened — never
   *  from `setFocus`, which runs on every layout, every click and every reorder: focusing there would
   *  rip the caret out of a description editor mid-word. */
  function focusPanel(p: P) {
    const el = p.el;
    if (!el.isConnected || el.hidden) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    // `preventScroll` because the stack does its own `scrollIntoView` with the inline/block nearest
    // it wants; letting focus scroll as well fought that and jumped the listing behind.
    try { el.focus({ preventScroll: true }); } catch { el.focus(); }
  }

  /** Give the keyboard back to whatever opened the panel that is closing.
   *
   *  Guarded on `contains`: if the user has already moved focus somewhere else entirely (clicked the
   *  page behind — which this NON-MODAL stack allows on purpose), closing a panel must not yank them
   *  back. Restoration is only correct when the thing being destroyed is where focus currently is. */
  function restoreFocus(p: P) {
    const active = document.activeElement as HTMLElement | null;
    const wasInside = !!active && (p.el === active || p.el.contains(active));
    if (!wasInside) return;
    const back = p.opener;
    if (back && back.isConnected && back.offsetParent !== null) {
      try { back.focus({ preventScroll: true }); } catch { back.focus(); }
      return;
    }
    // The opener is gone (a re-render replaced the row, or it scrolled out of a virtualised list).
    // Fall back to another open panel rather than dropping focus on `body`, where the next Tab would
    // restart from the top of the document.
    const next = panels.find((q) => q !== p && !q.collapsed) || panels.find((q) => q !== p);
    if (next) focusPanel(next);
    else if (active) active.blur();
  }

  // Tab CONTAINMENT, and deliberately not a hard trap — this stack is non-modal (`.ph-wrap` is
  // `pointer-events: none`, there is no scrim, and the page behind stays clickable by design). While
  // focus is INSIDE a panel, Tab and Shift+Tab cycle within that panel, so the keyboard cannot fall
  // through to a listing the panel is covering. Clicking the page behind — an act only this
  // non-modal surface permits — hands the keyboard back to the page, and Escape closes the panel and
  // restores the opener. Both exits are real, which is what keeps this from being a prison.
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Tab' || e.defaultPrevented || root.hidden || !panels.length) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active) return;
      const host = panels.find((q) => q.el === active || q.el.contains(active));
      if (!host || host.collapsed) return;
      const items = focusablesIn(host.el);
      if (!items.length) { e.preventDefault(); focusPanel(host); return; }
      const first = items[0], last = items[items.length - 1];
      // Focus sitting on the sheet itself (where `focusPanel` put it) is "before the first item".
      if (active === host.el) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    },
    true,
  );

  const byUid = (uid: number) => panels.find((p) => p.uid === uid) || null;
  const anchorOf = () => panels.find((p) => p.anchor) || null;
  const atCap = () => panels.length >= MAXPANELS;
  const syncOrder = () => panels.forEach((p) => panelsEl.appendChild(p.el));

  function showRail() {
    railEl.hidden = panels.length === 0;
    if (cfg.countEl) { cfg.countEl.textContent = String(panels.length); cfg.countEl.hidden = panels.length < 2; }
  }
  function setFocus(p: P | null) {
    focused = p; if (p) p.seq = ++focusSeq;
    panels.forEach((q) => { const f = q === focused; q.el.classList.toggle(cls.focus, f); cfg.onFocus?.(q, f); });
  }
  const setAnchorFlags = () => panels.forEach((q) => q.el.classList.toggle(cls.anchor, q.anchor));
  const setWidth = (p: P, px: number | null) => { if (px == null) p.el.style.removeProperty(cfg.widthVar); else p.el.style.setProperty(cfg.widthVar, px + 'px'); };

  // Auto-accordion: park the least-recently-focused overflow to strips; each strip eats STRIP px of the
  // same budget, so parking one can force another — iterate until it settles.
  function layout() {
    // `onLayout` fires on the empty path too: split view drives the page's content inset from the
    // stack's measured width, and "the stack is now empty" is exactly when that inset must go to 0.
    if (!panels.length) { root.hidden = true; railEl.hidden = true; cfg.onLayout?.(); return; }
    root.hidden = false;
    showRail(); setAnchorFlags();
    if (isMobile()) {
      panels.forEach((p) => { p.el.classList.remove(cls.collapsed); setWidth(p, null); p.el.style.display = (p === focused || panels.length === 1) ? '' : 'none'; });
      cfg.onLayout?.();
      return;
    }
    panels.forEach((p) => p.el.style.removeProperty('display'));
    const avail = containerW() - reserve();
    for (;;) {
      const strips = panels.filter((p) => p.collapsed).length;
      const budget = avail - strips * STRIP;
      const expandedList = panels.filter((p) => !p.collapsed);
      // Capacity was `floor(budget / MINEXP)` — one number for every panel. Summing each panel's OWN
      // floor is the same test generalised: with a uniform floor m, `len * m <= budget` is exactly
      // `len <= floor(budget / m)` for integer len, so a single-kind stack parks identically. At least
      // one panel always stays expanded, as `Math.max(1, cap)` guaranteed before.
      if (expandedList.length <= 1) break;
      if (expandedList.reduce((a, p) => a + minexpOf(p), 0) <= budget) break;
      // Split used to ALSO cap the visible count (1 panel, or 2 above a 1920 viewport). That was a
      // second mechanism answering the same question as the budget, and it answered it worse: a
      // hard-coded threshold cannot know a panel's floor or how many strips are already parked.
      // Space is now the only gate (Oleh, 2026-08-05), so a 27" fits three or four and a laptop
      // fits one — without a number in the code claiming to know which.
      // Overflow protects the FOCUSED panel first, the anchor second. That order matters and used to
      // be the other way round: with only an anchor beside it, the newly opened panel was the sole
      // non-anchor candidate, so opening something at a full stack parked the very thing you had just
      // asked for, into a 46px sliver on the right (Oleh, 2026-08-05). The anchor now yields when it
      // is the only alternative — it keeps the page's crumb, but it does not outrank a live request.
      const candidates = expandedList.filter((q) => q !== focused);
      const bySeq = (a: P, b: P) => a.seq - b.seq;
      const victim = candidates.filter((q) => !q.anchor).sort(bySeq)[0]
        || candidates.slice().sort(bySeq)[0]
        || expandedList[0];
      victim.collapsed = true;
      // The accordion's own doing, and the only place that is true. `unparkAuto()` reads this to give
      // back exactly the strips the width took, without touching one the user parked by hand.
      victim.autoParked = true;
    }
    panels.forEach((p) => p.el.classList.toggle(cls.collapsed, p.collapsed));
    const expanded = panels.filter((p) => !p.collapsed);
    const expAvail = avail - (panels.length - expanded.length) * STRIP;
    let ws = expanded.map((p) => p.w);
    const sum = ws.reduce((a, b) => a + b, 0);
    if (sum > expAvail) { const k = expAvail / sum; ws = ws.map((w, i) => Math.max(minwOf(expanded[i]), Math.round(w * k))); }
    let ei = 0;
    panels.forEach((p) => { if (p.collapsed) setWidth(p, STRIP); else setWidth(p, ws[ei++]); });
    cfg.onLayout?.();
  }


  // Stack resize (the shutter pill): drag drives the TOTAL width so every expanded panel ends equal. Panels
  // park ONE AT A TIME, leftmost first; pulling back out unparks them right to left.
  function stackResize(total: number): number | null {
    const n = panels.length; if (!n) return null;
    const maxTotal = containerW() - reserve();
    // Asking for more than the page can give is the moment worth reporting — the clamp below is silent.
    noteLimit(total > maxTotal + 1);
    const S = Math.min(total, maxTotal);
    let k = 0;
    // Panels park leftmost-first, so the i that stay expanded are the LAST i — sum THEIR floors.
    for (let i = n; i >= 1; i--) {
      const floors = panels.slice(n - i).reduce((a, p) => a + minwOf(p), 0);
      if (floors + (n - i) * STRIP <= S) { k = i; break; }
    }
    // One shared width for every expanded panel, so the clamp is the WIDEST floor among them.
    const floor = k ? Math.max(...panels.slice(n - k).map(minwOf)) : maxMinw();
    const w = k ? Math.round(Math.max(floor, Math.min((S - (n - k) * STRIP) / k, (maxTotal - (n - k) * STRIP) / k))) : floor;
    // A shutter drag is the USER choosing how wide the stack is, so whatever it parks is the user's
    // strip, not the accordion's — it must survive leaving split (see `unparkAuto`).
    panels.forEach((p, i) => { p.collapsed = i < n - k; p.autoParked = false; p.w = w; });
    layout();
    return k ? w : null;
  }

  const stackWidth = () => panels.reduce((a, p) => a + (p.collapsed ? STRIP : p.w), 0);

  // ── "that is as wide as it goes" ────────────────────────────────────────────────────────────
  // LATCHED, deliberately. Every reader of this fires from a pointermove, so an unlatched flash would
  // restart its own animation on each frame and sit frozen at full opacity — a red line that never
  // fades reads as a broken state, not as a limit. It re-arms the moment the drag comes back under.
  let restoring = false;
  let limitLatched = false;
  let limitTimer = 0;
  function noteLimit(hit: boolean) {
    if (!hit) { limitLatched = false; return; }
    if (limitLatched) return;
    limitLatched = true;
    root.classList.remove(cls.atLimit); void root.offsetWidth; root.classList.add(cls.atLimit);
    window.clearTimeout(limitTimer);
    limitTimer = window.setTimeout(() => root.classList.remove(cls.atLimit), 700);
  }

  /** The stack-resize drag, bound to any element. `lit` is the element that shows the active state —
   *  dragging the control column still lights the shutter pill, so the affordance and the gesture stay
   *  visibly the same thing. `ignore` guards on the event TARGET: a pointerdown that started on a
   *  control (the ＋, a bulk verb) must never begin a drag, and a coordinate test cannot say that. */
  function wireStackDrag(el: HTMLElement, lit: HTMLElement | null, ignore?: string) {
    el.addEventListener('pointerdown', (e) => {
      if (isMobile()) return;
      if (ignore && (e.target as HTMLElement).closest(ignore)) return;
      e.preventDefault();
      const flag = lit || el; flag.classList.add(cls.gripOn);
      const sx = (e as PointerEvent).clientX, st = stackWidth();
      const mv = (me: PointerEvent) => { stackResize(st + (sx - me.clientX)); };
      const end = () => {
        flag.classList.remove(cls.gripOn);
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', end);
        // (the drag already wrote each panel's own `w`; nothing is learned from it)
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', end);
    });
  }

  function wireShutter() {
    // The control column's background takes the same gesture, with a far bigger target than the pill.
    if (cfg.resizeEl) {
      wireStackDrag(cfg.resizeEl, cfg.shutterEl || null,
        cfg.resizeIgnoreSel ?? 'button, a, input, select, textarea, [role="button"], [data-ps-nodrag]');
    }
    const sh = cfg.shutterEl; if (!sh) return;
    wireStackDrag(sh, sh);
    sh.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      e.preventDefault();
      const n = panels.length || 1;
      let target = stackWidth() + (k === 'ArrowLeft' ? 32 : -32) * n;
      if (k === 'ArrowLeft') target = Math.max(target, maxMinw() + (n - 1) * STRIP);
      stackResize(target);
    });
  }

  function wireGrip(p: P) {
    const g = p.el.querySelector<HTMLElement>(cfg.gripSel); if (!g) return;
    g.addEventListener('pointerdown', (e) => {
      if (isMobile()) return;
      e.preventDefault(); g.classList.add(cls.gripOn);
      // A PARKED strip starts the drag from its own floor, not from the 46px it is painted at. That is
      // what makes the gesture mean anything: `p.w` on a parked panel is whatever it had before it
      // parked, and `layout()` paints a parked panel at STRIP regardless, so the old handler moved a
      // number nobody could see — the strip showed a resize cursor and did not resize (measured
      // 46 → 46 → 46, 2026-08-05). Seeding from the floor makes the first pixel of drag cross
      // COLLAPSE_AT, so the strip un-parks immediately and then follows the pointer.
      const sx = (e as PointerEvent).clientX, sw = p.collapsed ? minwOf(p) : p.w;
      const mv = (me: PointerEvent) => {
        const raw = sw + (sx - me.clientX);
        // Same threshold in both directions, so pulling back in re-parks exactly where pulling out
        // released it.
        if (raw < COLLAPSE_AT) { end(); parkPanel(p.uid); return; }
        // `autoParked` cleared here too: dragging a strip open is an explicit act, and every other
        // explicit act clears it. Inert today (`unparkAuto` also requires `collapsed`), but the
        // invariant is only worth having if it is true at every writer.
        if (p.collapsed) { p.collapsed = false; p.autoParked = false; setFocus(p); }
        const capped = Math.min(raw, containerW() * 0.7);
        noteLimit(raw > capped + 1);
        p.w = Math.max(minwOf(p), capped); layout();
      };
      const end = () => { g.classList.remove(cls.gripOn); document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', end); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', end);
    });
  }

  /** Un-park a panel. The width reset is the point: a strip keeps the `w` it had when it was parked,
   *  so without this an un-park would restore whatever the last drag left behind. */
  function unpark(p: P) { p.collapsed = false; p.autoParked = false; p.w = defW; }

  function buildPanel(id: string): P {
    const p = cfg.buildPanel(id);
    p.uid = uidSeq++; p.anchor = false; p.w = defW; p.seq = ++focusSeq; p.collapsed = false;
    // Injected here, not stamped into each host's template: four sheets mount this stack and the
    // affordance is the STACK's behaviour, not any one panel's content. Styled once in global.css.
    const exp = document.createElement('span');
    exp.className = 'ps-expand';
    exp.setAttribute('aria-hidden', 'true');
    exp.innerHTML = '<span class="iconify lucide--chevrons-left-right size-4"></span>';
    p.el.appendChild(exp);
    wireGrip(p);
    return p;
  }

  function createPanel(id: string, anchor: boolean, init?: (p: P) => void): P {
    // WHO ASKED FOR THIS — captured BEFORE anything is built, because cloning the template and
    // rendering it can move focus on its own. `restoring` is excluded: a session rebuild on page
    // load is not a request, and five panels each grabbing focus as they mount would leave the
    // caret wherever the race ended.
    const opener = restoring ? null : (document.activeElement as HTMLElement | null);
    if (anchor && atCap()) evictLRU();
    const p = buildPanel(id);
    p.opener = opener && opener !== document.body ? opener : null;
    p.anchor = anchor;
    panelsEl.appendChild(p.el);
    // ALWAYS born expanded. It used to be born PARKED when `roomToExpand` said no, which answered the
    // wrong question: "is there room as things stand" rather than "what should yield for this". The
    // user asked for this panel; something older is what gives way. `layout()` then parks whatever it
    // has to, and it will not pick this one — it is focused.
    p.collapsed = false;
    cfg.loadInto(p, id);
    if (init) init(p);
    if (anchor) panels.unshift(p); else panels.push(p);
    syncOrder();
    cfg.render(p);
    setFocus(p);
    // No flash on restore: the signal answers "which one did you just ask for", and five of them
    // firing at once on page load answers nothing.
    if (!anchor && !restoring && cfg.flash) cfg.flash(p.el);
    // Focus enters the overlay (D45 item 1). AFTER `render`, so the sheet has its content and
    // `focusablesIn` can see it; not on a restore, for the reason given at `opener` above.
    if (!restoring) focusPanel(p);
    return p;
  }

  function closePanel(p: P) {
    const i = panels.indexOf(p); if (i < 0) return;
    lastClosed = { id: cfg.panelKey(p), anchor: p.anchor };
    // Before the element is torn down, while `document.activeElement` can still be tested against it.
    restoreFocus(p);
    cfg.onDestroy?.(p);
    // The element leaves the DOM on the next macrotask (this can be called from a handler on a node
    // inside it), but it must stop OCCUPYING WIDTH immediately: `layout()` two lines down measures
    // `panelsEl` to publish the split inset, and a corpse still in the flex row made that measurement
    // one 46px strip too wide. In split that painted as a 46px seam between the page and the stack —
    // and, worse, the page inset stayed 46px too large, pushing the content 8px BELOW its own floor
    // (measured on /schema at 1440: content 792 against a floor of 800). `hidden` is display:none, so
    // the width goes to 0 on the same frame while the deferred `remove()` is left exactly as it was.
    const el = p.el; el.hidden = true; window.setTimeout(() => el.remove(), 0);
    panels.splice(i, 1);
    if (focused === p) { const n = panels[Math.max(0, i - 1)]; if (n) setFocus(n); else focused = null; }
    if (!panels.length) { closeAll(); return; }
    cfg.toast(cfg.text.closed, undoAction());
    layout();
  }
  function teardown() {
    // The whole stack is going, so the keyboard has to land somewhere deliberate. The FOCUSED panel
    // owns the restore — it is the one whose opener the user most recently came from.
    const held = panels.find((q) => { const a = document.activeElement; return !!a && (q.el === a || q.el.contains(a)); });
    if (held) restoreFocus(held);
    panels.slice().forEach((p) => { cfg.onDestroy?.(p); p.el.remove(); });
    panels = []; focused = null; cfg.onEmpty?.(); root.hidden = true; railEl.hidden = true;
  }
  function closeAll() { teardown(); cfg.hideToast(); }
  /** The user pressed "Close all". Same teardown, but the panels are remembered and re-created in
   *  order by the Undo action — a destructive bulk verb that cannot be taken back is not shippable,
   *  and `closeAll` deliberately stays silent because it fires on context changes nobody requested. */
  function closeAllWithUndo() {
    if (!panels.length) return;
    const restore = panels.map((p) => ({ id: cfg.panelKey(p), anchor: p.anchor })).filter((r) => r.id);
    const n = panels.length;
    teardown();
    lastClosed = null; // the single-panel undo would otherwise re-open one panel over this offer
    cfg.toast(
      cfg.text.closedAll ? cfg.text.closedAll(n) : `Closed ${n} panels`,
      restore.length ? { label: 'Undo', run: () => { restore.forEach((r) => createPanel(r.id, r.anchor && !anchorOf())); layout(); } } : null,
    );
  }
  /** Park every panel to a strip. Deliberately ONE line: `collapsed` is stored per panel and `layout()`
   *  only ever SETS it (the accordion parks overflow, it has no path that un-parks), so an all-parked
   *  stack is already a stable state — it survives re-layout and window resize with no flag and no
   *  mode. Un-parking is always an explicit act: click a strip (`expandPanel`), open a panel, or drag
   *  the stack wider (`stackResize`, the one writer that clears `collapsed`). */
  function collapseAll() { panels.forEach((p) => { p.collapsed = true; p.autoParked = false; }); layout(); }
  /** The inverse, and the reason the control is a TOGGLE rather than a one-way verb: having folded
   *  everything to get the table back, the way out was dragging the shutter open again (Oleh,
   *  2026-08-04). Every panel returns to the remembered width; `layout()` then re-parks whatever
   *  genuinely does not fit, so this asks for expansion rather than promising it. */
  function expandAll() { panels.forEach(unpark); layout(); }
  /** True when there is something to expand — what the host paints the toggle from. */
  function allCollapsed() { return panels.length > 0 && panels.every((p) => p.collapsed); }

  function evictLRU(announce = true) {
    const victim = panels.filter((p) => !p.anchor).sort((a, b) => a.seq - b.seq)[0] || panels[0]; if (!victim) return;
    lastClosed = { id: cfg.panelKey(victim), anchor: victim.anchor };
    // An eviction is the stack destroying a panel the user did not ask to lose; if the keyboard
    // happened to be in it, it must not be dropped on `body`.
    restoreFocus(victim);
    cfg.onDestroy?.(victim);
    victim.el.remove();
    panels = panels.filter((p) => p !== victim);
    if (announce) cfg.toast(cfg.text.evicted(MAXPANELS), undoAction());
  }

  /** How many panels the SPACE allows. Overlay mode: `MAXPANELS`, because floating panels cost the
   *  page nothing. Split: the content floor is absolute, so the panels divide what is left — one
   *  panel at its floor, plus a 46px strip for every other. Never below 1.
   *
   *  This is the number that replaced `SPLIT_TWO_AT`. At 1440 (work column 1361) it works out at 6;
   *  at 1920 and above the 10-panel ceiling takes over again. Nothing in here knows a viewport. */
  function spaceCap(): number {
    if (!isSplitNow()) return MAXPANELS;
    const avail = containerW() - reserve();
    return Math.max(1, Math.min(MAXPANELS, 1 + Math.floor((avail - maxMinw()) / STRIP)));
  }

  /** Close least-recently-focused panels until the space cap is satisfied. `headroom` is how many are
   *  about to be added.
   *
   *  Called ONLY from a user act — opening a panel, or switching split on. Deliberately NEVER from
   *  `layout()`: layout runs on every window resize, and a stack that closed panels while you dragged
   *  the window narrower would be destroying work in answer to a gesture that never asked for it.
   *  So a resize squeezes and parks; only an explicit act can cost you a panel.
   *
   *  The stack is never emptied — at the narrowest split a second panel is born parked instead, which
   *  dips under the floor by one strip. That is the one place the floor bends, and it bends rather
   *  than turning every open into a destroy. */
  function evictForRoom(headroom = 0): number {
    let n = 0;
    while (panels.length + headroom > spaceCap() && panels.length > 1) { evictLRU(false); n++; }
    return n;
  }

  /** Say what `evictForRoom` did. Split out from the eviction itself for ORDER: when the panel being
   *  opened is also born parked, `createPanel` fires its own "opened as a strip" toast, and whichever
   *  speaks last is the only one heard. A strip is visible and flashes — it announces itself. A closed
   *  panel is gone with nothing on screen to say so, so that message has to be the one that survives.
   *  Undo restores the evicted panel; it can push the stack one over the space cap, which is the right
   *  way round — undo is the user asking for that panel back by name. */
  function announceEviction(n: number) {
    if (n) cfg.toast(cfg.text.evictedForRoom(n), n === 1 ? undoAction() : null);
  }

  // ── Remembering a section's panels across the section boundary ─────────────────────────────
  // A tab switch keeps its panels outright; a SECTION switch is a real page load, so the only way to
  // survive it is to write the arrangement down. Dan asked for exactly this (Slack, 2026-08-05):
  // leaving Data for Schema should not cost the five minutes spent arranging Data.
  //
  // sessionStorage, not localStorage. The thing being remembered is a working view, not a preference
  // — the complaint was about crossing sections mid-task, not about coming back next Tuesday to five
  // panels from last week. Per tab, cleared when the tab closes, which is the same lifetime as the
  // work itself. One word to change if that turns out too short.
  //
  // Only IDS are stored. Panel bodies are rebuilt from the page's own data on restore, so a fixture
  // that has since changed cannot resurrect a stale copy of itself; `canOpen` drops anything that no
  // longer resolves.
  type Saved = { ids: { id: string; anchor: boolean }[]; focus: string | null };

  function saveSession() {
    if (!cfg.sessionKey) return;
    try {
      const ids = panels.map((p) => ({ id: cfg.panelKey(p), anchor: p.anchor })).filter((e) => e.id);
      const payload: Saved = { ids, focus: focused ? cfg.panelKey(focused) : null };
      if (!ids.length) sessionStorage.removeItem(cfg.sessionKey);
      else sessionStorage.setItem(cfg.sessionKey, JSON.stringify(payload));
    } catch { /* best-effort — a convenience, not correctness */ }
  }

  /** Rebuild what was open when this section was last left. ONE panel comes back expanded — the one
   *  that had focus — and the rest as strips.
   *
   *  Dan's own sketch was to bring everything back closed. Argued down (Oleh, 2026-08-05): a column of
   *  five anonymous strips makes you open each one to remember what it was, and the rotated name on a
   *  46px strip reads too slowly to save you. Restoring the last-focused panel open says WHERE you
   *  were, not merely that you were somewhere.
   *
   *  Deliberately does not evict to satisfy the content floor: restoring is not a request for a new
   *  panel, and the same rule that stops a window resize from closing panels applies here. `layout()`
   *  parks what does not fit, and nothing is lost. */
  /** How many saved panels could NOT be opened yet — 0 means the arrangement is fully back and the
   *  caller can stop retrying. */
  function restoreSession(): number {
    if (!cfg.sessionKey) return 0;
    let saved: Saved | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(cfg.sessionKey) || 'null'); } catch { return 0; }
    if (!saved || !Array.isArray(saved.ids) || !saved.ids.length) return 0;
    // Which of the saved ids are still missing. Bailing on `panels.length` — the first version — made
    // a PARTIAL restore permanent: if the settle fired while only some kinds had registered, the ids
    // belonging to the rest were dropped for good, silently, on the very next call. A mixed-kind
    // arrangement (a record beside an entity beside a file) is the case that loses panels.
    const openNow = new Set(panels.map((q) => cfg.panelKey(q)));
    const missing = saved.ids.filter((e) => e && typeof e.id === 'string' && !openNow.has(e.id));
    if (!missing.length) return 0;
    const firstPass = !panels.length;
    let pending = 0;
    restoring = true;
    try {
      for (const e of missing.slice(0, MAXPANELS - panels.length)) {
        // Not openable YET is not the same as not openable: its kind may register later, so it is
        // counted rather than discarded, and the caller comes back.
        if (cfg.canOpen && !cfg.canOpen(e.id)) { pending += 1; continue; }
        createPanel(e.id, !!e.anchor);
      }
    } finally { restoring = false; }
    if (!panels.length) return pending;
    // The one-expanded arrangement is the FIRST pass's business only. Re-running it on a retry would
    // collapse panels the user had already expanded while the late kind was still loading.
    if (firstPass) {
      const keep = panels.find((q) => cfg.panelKey(q) === saved!.focus) || panels[panels.length - 1];
      panels.forEach((q) => { q.collapsed = q !== keep; });
      keep.w = defW; setFocus(keep);
    }
    layout();
    return pending;
  }

  function open(id: string, init?: (p: P) => void) {
    if (cfg.canOpen && !cfg.canOpen(id)) { cfg.onMissing?.(id); return; }
    root.hidden = false;
    // REUSING a panel is still an open, so the same focus contract applies — and the opener is
    // re-recorded, because the row you came from this time is the row you should go back to.
    const opener = restoring ? null : (document.activeElement as HTMLElement | null);
    const remember = (p: P) => { if (opener && opener !== document.body && !p.el.contains(opener)) p.opener = opener; };
    const ex = panels.find((q) => cfg.panelKey(q) === id);
    if (ex) { unpark(ex); init?.(ex); setFocus(ex); cfg.render(ex); ex.el.scrollIntoView({ inline: 'nearest', block: 'nearest' }); layout(); remember(ex); if (!restoring) focusPanel(ex); return; }
    const a = anchorOf();
    if (a) { unpark(a); cfg.loadInto(a, id); init?.(a); setFocus(a); cfg.render(a); layout(); remember(a); if (!restoring) focusPanel(a); }
    else { createPanel(id, true, init); layout(); }
  }

  function openBeside(source: P | null, id: string, init?: (p: P) => void) {
    if (cfg.canOpen && !cfg.canOpen(id)) { cfg.onMissing?.(id); return; }
    root.hidden = false;
    if (isMobile()) { if (cfg.mobileOpen) cfg.mobileOpen(source || focused, id); else open(id, init); return; }
    const ex = panels.find((q) => cfg.panelKey(q) === id);
    // Picking something ALREADY open reuses its panel — and used to do so silently, so the answer
    // to "where did it go" was nowhere (Oleh, 2026-08-05). It flashes too: the signal answers
    // "which panel is the one you just asked for", which is as true of a reused panel as a new one.
    if (ex) {
      const opener = restoring ? null : (document.activeElement as HTMLElement | null);
      unpark(ex); setFocus(ex); cfg.render(ex); layout(); cfg.flash?.(ex.el);
      if (opener && opener !== document.body && !ex.el.contains(opener)) ex.opener = opener;
      if (!restoring) focusPanel(ex);
      return;
    }
    if (atCap()) {
      cfg.toast(cfg.text.capReached(MAXPANELS),
        { label: 'Close oldest', icon: 'lucide--layers', run: () => { evictLRU(false); createPanel(id, false, init); layout(); } }, 6000);
      return;
    }
    const closed = evictForRoom(1);
    createPanel(id, false, init); layout();
    announceEviction(closed);
  }

  function detachPanel(p: P) {
    if (!p.anchor) return;
    p.anchor = false; setAnchorFlags();
    if (cfg.text.detached) cfg.toast(cfg.text.detached, null);
  }
  function parkPanel(uid: number) { const p = byUid(uid); if (!p || p.collapsed) return; p.collapsed = true; p.autoParked = false; layout(); }

  /** Give back every strip the AUTO-ACCORDION made, and none that the user made by hand.
   *
   *  Leaving split view is the caller. Split's reserve is `rail + MINCONTENT` against the overlay
   *  `TABLEGAP`, so turning the mode off hands the stack several hundred px back — but `collapsed` is
   *  stored on the panel and `layout()` only ever parks, never un-parks, so the strips the mode made
   *  stayed strips in a width that could hold them (Oleh reported it as accepted jank while this was
   *  one page; as a standard it reads as the toggle eating panels). This un-parks and re-lays-out, so
   *  anything that STILL does not fit is parked again by the same accordion on the same frame — the
   *  floor is never bent, and a panel the user parked deliberately is never touched. */
  function unparkAuto() {
    let n = 0;
    panels.forEach((p) => { if (p.collapsed && p.autoParked) { unpark(p); n++; } });
    if (n) layout();
    return n;
  }
  /** Clicking a parked strip. An explicit request for that panel, so the keyboard goes with it —
   *  a strip has no focusable content of its own, so without this the caret stays on the strip's
   *  own button while the sheet it just expanded sits unreachable beside it. */
  function expandPanel(uid: number) { const p = byUid(uid); if (!p) return; const o = document.activeElement as HTMLElement | null; unpark(p); setFocus(p); layout(); if (o && o !== document.body && !p.el.contains(o)) p.opener = o; focusPanel(p); }

  // Reorder — drag the ⠿ grip to live-swap panel order (anchor stays in slot 0).
  function uidAtX(x: number): number { for (const p of panels) { const r = p.el.getBoundingClientRect(); if (x >= r.left && x <= r.right) return p.uid; } return 0; }
  function movePanel(dragUid: number, overUid: number) {
    const from = panels.findIndex((p) => p.uid === dragUid), to = panels.findIndex((p) => p.uid === overUid);
    if (from < 0 || to < 0 || from === to) return;
    if (panels[from].anchor) return;
    if (anchorOf() && to === 0) return;
    const [m] = panels.splice(from, 1); panels.splice(to, 0, m);
    syncOrder(); layout();
  }
  document.addEventListener('pointerdown', (e) => {
    const h = (e.target as HTMLElement).closest<HTMLElement>(cfg.reorderSel); if (!h || isMobile()) return;
    const sheet = h.closest<HTMLElement>(cfg.panelSel); const p = panels.find((q) => q.el === sheet); if (!p) return;
    e.preventDefault(); const dragUid = p.uid, sx = (e as PointerEvent).clientX; let dragging = false; h.classList.add(cls.gripOn);
    const mv = (me: PointerEvent) => {
      if (!dragging && Math.abs(me.clientX - sx) > 6) { dragging = true; p.el.classList.add(cls.dragging); if (anchorOf()) panelsEl.classList.add(cls.reordering); }
      if (!dragging) return; const over = uidAtX(me.clientX); if (over && over !== dragUid) movePanel(dragUid, over);
    };
    const end = () => { h.classList.remove(cls.gripOn); p.el.classList.remove(cls.dragging); panelsEl.classList.remove(cls.reordering); document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', end); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', end);
  });

  const undoAction = (): ToastAction | null => { if (!lastClosed) return null; const s = lastClosed; return { label: 'Undo', run: () => reopenLastClosed(s) }; };
  function reopenLastClosed(s?: { id: string; anchor: boolean } | null) {
    const t = s || lastClosed; if (!t || !t.id) return;
    createPanel(t.id, t.anchor && !anchorOf()); layout();
  }

  wireShutter();

  // TWO hooks, and the second is the one that matters in practice.
  //
  // `pagehide` covers a real unload — typed URL, reload, tab close — and unlike `unload` it does not
  // disqualify the page from bfcache. Coming BACK via bfcache needs no restore, since the live panels
  // come with the page, so it only has to be correct on the way out.
  //
  // But this app runs Astro's ClientRouter, and a SOFT swap fires no `pagehide` at all — there is not
  // one occurrence of it anywhere in the Astro runtime. So clicking `Reports` in the sidebar, which is
  // how anyone actually leaves a section, saved nothing: measured 2026-08-06, three panels arranged on
  // /schema and `panels:schema` still null after the swap. The whole cross-section memory was working
  // only for people who retype the URL. `astro:before-swap` is the soft-navigation counterpart.
  if (cfg.sessionKey) {
    window.addEventListener('pagehide', saveSession);
    document.addEventListener('astro:before-swap', saveSession);
  }

  return {
    panels: () => panels,
    focused: () => focused,
    anchorOf, byUid,
    open, openBeside, createPanel, closePanel, closeAll, closeAllWithUndo, collapseAll, expandAll, allCollapsed, detachPanel, parkPanel, expandPanel, evictLRU,
    layout, setFocus, atCap, evictForRoom, announceEviction, spaceCap, unparkAuto, saveSession, restoreSession,
    reopenLastClosed: () => reopenLastClosed(),
  };
}
