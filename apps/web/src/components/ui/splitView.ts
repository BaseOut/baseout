/**
 * Split View — a mode of `pattern-multi-panel-drawer`, on every section that mounts `PanelHost`.
 *
 * Instead of the stack OVERLAYING the page, the page content gives up the width and the panels sit
 * beside it. The implementation is deliberately the cheapest honest one — `.ph-wrap` stays
 * `position: fixed` and the work column is pushed in by the stack's measured width
 * (`--ph-split-w`, read by the `[data-split-view="on"]` rule in styles/global.css). No DOM
 * restructure.
 *
 * It shipped on 2026-08-05 as an experiment on `/data` and this file said so until 2026-08-06, when
 * `PanelHost` moved onto Schema and both Reports views. A mode that appears on five routes is not a
 * spike, and the three things the spike listed as accepted jank — leaving split not un-parking what
 * the mode parked, the toggle's tooltip going stale under the pointer, and the preference being one
 * global flag for pages of different shapes — were accepted only because it was one page.
 *
 * Three rules this module exists to keep:
 *
 * 1. **The sidebar collapses ONCE, when split is switched on** — never on panel open. Reflow under
 *    a clicking hand is the exact complaint `decision-panels-overlay-not-reflow` was written for.
 *    It drives the app's OWN collapse control (`#layout-sidebar-hover-trigger`); there is no second
 *    collapse mechanism.
 * 2. **Switching split OFF does not expand the sidebar back.** The user may have railed it on
 *    purpose; a layout mode must not undo a choice it did not make.
 * 3. **The preference is PER SECTION.** See `keyFor` below for the argument.
 */

/**
 * PER-SECTION, not global (decided 2026-08-06).
 *
 * The flag used to be one `panel-split` for the whole app, which was the only sane thing while the
 * mode existed on one route. On five routes it means turning split on over a Data table silently
 * decides the layout of a report you have not opened yet — and those pages are not the same shape.
 * The same argument already carried for `TABLEGAP` and now for `MINCONTENT`: the amount of itself a
 * page must keep is a fact ABOUT THAT PAGE, and so is whether giving that width up is worth it. A
 * 389-row Schema tree beside a field definition is the mode working; a 1200px report document is a
 * thing you are reading, and the panels beside it are the reference, so the trade is genuinely
 * different and the user should get to make it twice.
 *
 * The cost, stated honestly: the mode is now something you switch on more than once, and a user who
 * wants it everywhere has to say so on each section. That is the same shape as a per-table sort
 * preference, and it is the cheaper mistake — a mode you have to turn on is a smaller surprise than
 * a page that has silently reflowed under a decision you made somewhere else.
 *
 * localStorage, not sessionStorage: this is a preference (it should survive the tab), unlike the
 * open panel ARRANGEMENT, which is session-scoped for the opposite reason.
 */
const KEY_PREFIX = 'panel-split:';
/** The pre-2026-08-06 global key. Migrated to `data` — the one section where it was ever chosen. */
const LEGACY_KEY = 'panel-split';

function keyFor(section: string): string { return KEY_PREFIX + section; }

/**
 * One-time migration of the old global flag onto `panel-split:data`, then delete it. Adopting it for
 * every section instead would spread Data's choice to pages it was never made for, which is the very
 * thing per-section exists to stop.
 */
function migrateLegacy(): void {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old === null) return;
    if (localStorage.getItem(keyFor('data')) === null) localStorage.setItem(keyFor('data'), old);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* private mode — nothing to migrate into */ }
}

/* There is no panel-COUNT cap and no viewport threshold here any more. Both used to live in this
 * file as `SPLIT_TWO_AT = 1920` / `splitCap()`, and both were guesses standing in for an arithmetic
 * the stack could do exactly: how many panels fit once the listing keeps its minimum width. That
 * lives in `panelStack.spaceCap()` now, off MINCONTENT, the measured control column and each
 * panel's own floor — so a wide screen earns a third panel instead of being told 2 by a literal. */

export function isSplit(section: string): boolean {
  migrateLegacy();
  try { return localStorage.getItem(keyFor(section)) === '1'; } catch { return false; }
}

/** Collapse the app's left navigation to its rail using the control it already has. */
function railSidebar() {
  const t = document.getElementById('layout-sidebar-hover-trigger') as HTMLInputElement | null;
  if (t && !t.checked) t.checked = true;
}

const TOGGLE_TIP = 'Toggle sidebar';
const TOGGLE_TIP_LOCKED = 'Turn off split view to expand the sidebar';

/**
 * Lock the sidebar's collapse control while split is on. Split rails the sidebar for a reason — the
 * width it gives up is what the panels stand in — so leaving the toggle live offered an action that
 * the next `layout()` would undo, which reads as a broken button rather than a busy one.
 *
 * The `for` attribute comes off rather than `pointer-events` going to none. The control is a LABEL,
 * and a label with no `for` is inert while still hovering — kill pointer events instead and the
 * tooltip goes with them, leaving a dimmed control that refuses to say why. Saying why is the whole
 * point of disabling it.
 */
function lockSidebarToggle(locked: boolean) {
  const el = document.querySelector<HTMLElement>('.sb-collapse-toggle');
  if (!el) return;
  if (locked) {
    el.setAttribute('for', '');
    el.removeAttribute('for');
    el.setAttribute('aria-disabled', 'true');
    el.setAttribute('data-tip', TOGGLE_TIP_LOCKED);
    el.setAttribute('aria-label', TOGGLE_TIP_LOCKED);
  } else {
    el.setAttribute('for', 'layout-sidebar-hover-trigger');
    el.removeAttribute('aria-disabled');
    el.setAttribute('data-tip', TOGGLE_TIP);
    el.setAttribute('aria-label', TOGGLE_TIP);
  }
}

/**
 * RELEASE THE LOCK ON THE WAY OUT OF A PAGE — and `astro:before-swap`, not `pagehide`.
 *
 * The sidebar survives a client-side navigation (it is persisted), so the `.sb-collapse-toggle` that
 * `lockSidebarToggle` stripped the `for` off is the SAME NODE on the next page. Land on a route that
 * mounts no `PanelHost` — `/reports`, the list — and there is no code left to unlock it: measured
 * 2026-08-06, soft-navigating from a split-on `/data` left the sidebar's collapse control dead, dimmed
 * and explaining itself with "Turn off split view to expand the sidebar" on a page with no split view
 * and no toggle to press. `data-split-view` and `--ph-split-w` are cleared by the root-attribute swap;
 * this one control is not, because it lives in the persisted subtree.
 *
 * Release unconditionally on the way out and let the next page state itself: a `PanelHost` that mounts
 * with split on re-locks in its own restore, and one that never mounts leaves it correctly free. A
 * soft navigation fires NO `pagehide`, so this hook is the only one that runs.
 */
{
  const w = window as Window & { __splitUnlockWired?: boolean };
  if (!w.__splitUnlockWired) {
    w.__splitUnlockWired = true;
    document.addEventListener('astro:before-swap', () => lockSidebarToggle(false));
  }
}

/**
 * Apply the mode. `announce` false is the page-load restore (same effect, but it is not a fresh
 * user act, so callers can tell the two apart if a toast is ever wanted).
 */
/** How long the work column eases when the MODE changes. Matched to the sidebar's own collapse so
 *  the two move together rather than one chasing the other. */
const MODE_MS = 300;
let animTimer = 0;

/**
 * APPLY the mode without CHOOSING it — split out on 2026-08-11, when the narrow gate needed exactly
 * this and `setSplit` was the only door.
 *
 * The two halves had been welded together because every caller wanted both. Two now do not:
 *
 *   · the page-load restore, which re-stamps the html attribute and the sidebar lock after a soft
 *     swap. It was writing back the value it had just read — a no-op, and invisible for that reason.
 *   · the boundary listener, where narrowing must turn the mode OFF on screen while leaving the
 *     user's answer for this section exactly where they left it.
 *
 * With one function the second caller silently destroyed the preference: measured — split on at
 * 1440, drag to 500, `panel-split:schema` had become `'0'`, so widening back gave you a page that
 * had forgotten a choice you never revoked. The comment above it claimed the opposite, which is the
 * part worth naming: a promise in a comment is not a mechanism.
 */
export function applySplit(on: boolean, animate = true): void {
  paintSplit(on, animate);
}

export function setSplit(section: string, on: boolean, animate = true): void {
  try { localStorage.setItem(keyFor(section), on ? '1' : '0'); } catch { /* ignore */ }
  paintSplit(on, animate);
}

function paintSplit(on: boolean, animate: boolean): void {
  // Arm the easing BEFORE the width changes, and disarm it after — outside this window the inset is
  // written on every frame of a resize drag, where a transition would lag behind the pointer.
  // `animate` false is the page-load RESTORE: the same effect, but there is no "before" for the page
  // to ease from, so easing it would animate the work column on every navigation for no reason.
  const root = document.documentElement;
  if (animate) {
    root.dataset.splitAnim = '1';
    window.clearTimeout(animTimer);
    animTimer = window.setTimeout(() => { delete root.dataset.splitAnim; }, MODE_MS + 60);
  }
  root.dataset.splitView = on ? 'on' : 'off';
  // Only ever collapses. Turning split off leaves the sidebar exactly where the user left it.
  if (on) railSidebar();
  lockSidebarToggle(on);
}
