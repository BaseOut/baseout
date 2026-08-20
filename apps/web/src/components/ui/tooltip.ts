/**
 * Tooltips, painted in the browser's TOP LAYER (catalog: the Tooltip primitive).
 *
 * daisyUI draws a tooltip as a CSS pseudo-element on the trigger itself, so any ancestor with
 * `overflow: auto/hidden` clips it — and no z-index can escape a clipping box. That is why the same
 * bug kept coming back and kept getting patched one site at a time (the Schema toolbar, the
 * locked-scope wrapper, the pin-bar ＋, a tab's ✕ inside a scroller).
 *
 * This fixes it once, for every `[data-tip]` in the app: ONE shared bubble, shown via the Popover
 * API, which puts it in the top layer — above every stacking context and outside every clipping box,
 * by definition. Positioned in JS from the trigger's rect.
 *
 * THE CALL SITE DOES NOT CHANGE. Keep writing `class="tooltip tooltip-left" data-tip="…"`; the
 * placement classes still decide the side, `global.css` switches daisyUI's pseudo-elements off so
 * there is never a second bubble. `.tooltip-open` (forced-open, only used by the catalog demo) is
 * left to daisyUI and ignored here.
 *
 * Not CSS anchor positioning: Firefox still lacks it, while the Popover API ships in all three
 * engines — and where it doesn't, this degrades to a plain fixed-position element.
 */

import { pushEscape, raiseEscape, type EscapeEntry } from '../../lib/escapeStack';

/** Distance between the trigger and the bubble (4px grid). */
const GAP = 8;
/** Keep the bubble this far from the viewport edge when clamping. */
const EDGE = 8;

type Side = 'top' | 'bottom' | 'left' | 'right';

let bubble: HTMLElement | null = null;
let current: HTMLElement | null = null;

/** The one bubble. Re-created if a view transition swapped the body out from under it. */
function ensureBubble(): HTMLElement {
  if (bubble?.isConnected) return bubble;
  const el = document.createElement('div');
  el.className = 'tt-pop';
  el.setAttribute('role', 'tooltip');
  // `manual` — we own show/hide entirely; `auto` would close on any outside pointer-down and
  // fight the light-dismiss of real popovers (the ＋ picker, the fields menu).
  el.setAttribute('popover', 'manual');
  el.innerHTML = '<span class="tt-pop-txt"></span><span class="tt-pop-tail" aria-hidden="true"></span>';
  // documentElement, not body — Astro's ClientRouter replaces the body on navigation.
  document.documentElement.appendChild(el);
  bubble = el;
  return el;
}

const sideOf = (el: HTMLElement): Side =>
  el.classList.contains('tooltip-bottom') ? 'bottom'
  : el.classList.contains('tooltip-left') ? 'left'
  : el.classList.contains('tooltip-right') ? 'right'
  : 'top'; // daisyUI's default

/** Place the bubble on `side`, flipping to the opposite side when it would leave the viewport. */
function place(el: HTMLElement, side: Side) {
  const b = ensureBubble();
  const r = el.getBoundingClientRect();
  const bw = b.offsetWidth;
  const bh = b.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // Flip when there isn't room — a tooltip pinned to the top edge over its own trigger is worse
  // than one on the other side.
  if (side === 'top' && r.top - bh - GAP < EDGE && r.bottom + bh + GAP <= vh - EDGE) side = 'bottom';
  else if (side === 'bottom' && r.bottom + bh + GAP > vh - EDGE && r.top - bh - GAP >= EDGE) side = 'top';
  else if (side === 'left' && r.left - bw - GAP < EDGE && r.right + bw + GAP <= vw - EDGE) side = 'right';
  else if (side === 'right' && r.right + bw + GAP > vw - EDGE && r.left - bw - GAP >= EDGE) side = 'left';

  const vertical = side === 'top' || side === 'bottom';
  let x = vertical ? r.left + r.width / 2 - bw / 2 : side === 'left' ? r.left - bw - GAP : r.right + GAP;
  let y = vertical ? (side === 'top' ? r.top - bh - GAP : r.bottom + GAP) : r.top + r.height / 2 - bh / 2;

  // Clamp inside the viewport, then point the tail at the trigger's centre rather than at the
  // bubble's — otherwise a clamped bubble grows a tail aimed at nothing.
  const cx = x;
  const cy = y;
  x = Math.min(Math.max(x, EDGE), Math.max(EDGE, vw - bw - EDGE));
  y = Math.min(Math.max(y, EDGE), Math.max(EDGE, vh - bh - EDGE));

  b.dataset.side = side;
  b.style.left = `${Math.round(x)}px`;
  b.style.top = `${Math.round(y)}px`;
  const shift = vertical ? cx - x : cy - y;
  b.style.setProperty('--tt-shift', `${Math.round(shift)}px`);
}

function show(el: HTMLElement) {
  const tip = el.dataset.tip;
  if (!tip) return;
  const b = ensureBubble();
  current = el;
  // A hint that just appeared is on top of whatever it points at — take the top of the Escape stack.
  raiseEscape(escapeEntry);
  b.querySelector<HTMLElement>('.tt-pop-txt')!.textContent = tip;
  // Show BEFORE measuring — a display:none element has no size to position against.
  if (!b.matches(':popover-open')) {
    try { (b as HTMLElement & { showPopover(): void }).showPopover(); }
    catch { b.classList.add('tt-open'); /* no Popover API — plain fixed element, still unclipped */ }
  }
  place(el, sideOf(el));
  b.classList.add('tt-visible');
  // With ONE bubble this is cheap: point the trigger at it while it is up, so the hint is announced
  // rather than being a purely visual affordance.
  b.id ||= 'tt-bubble';
  el.setAttribute('aria-describedby', b.id);
}

/**
 * The stack entry. Kept as a module constant so `show()` can `raiseEscape()` it: the bubble is
 * painted in the TOP LAYER, so whenever a hint is up it is literally the topmost thing on screen and
 * must get the press first — and this module is imported early, which would otherwise bury it at the
 * bottom of a LIFO stack under every panel that wired later.
 */
const escapeEntry: EscapeEntry = {
  label: 'tooltip',
  onEscape: () => {
    if (!current) return false;
    hide();
    return true;
  },
};

function hide() {
  current?.removeAttribute('aria-describedby');
  current = null;
  if (!bubble) return;
  bubble.classList.remove('tt-visible', 'tt-open');
  try { (bubble as HTMLElement & { hidePopover(): void }).hidePopover(); } catch { /* wasn't open */ }
}

/**
 * Re-read `data-tip` for a trigger whose bubble is UP right now, and repaint it.
 *
 * For a control that changes what it says when you press it — a MODE toggle — the bubble goes stale
 * under the pointer, and it takes three listeners in this file to see why. `pointerdown` hides the
 * bubble, but the click that follows also moves FOCUS, and `focusin` shows it again — both before
 * the control's own click handler has run. So the sequence is show(old) → hide → show(old) →
 * handler rewrites `data-tip`, and the bubble sits there describing the state you just left until
 * the pointer leaves the button entirely. Measured on the split-view toggle, 2026-08-06.
 *
 * A state-changing control therefore calls this after rewriting its own `data-tip`. No-op unless
 * that exact element is the one currently described, so it is safe to call unconditionally.
 */
export function refreshTooltip(el: HTMLElement): void {
  if (current !== el) return;
  if (!el.dataset.tip) { hide(); return; }
  show(el);
}

/**
 * The text a sighted user can actually READ on the trigger.
 *
 * NOT `innerText`: that reports visually-hidden text as present. A label clipped to 1×1 for screen
 * readers is invisible on screen, so counting it makes the hint look redundant when it is the only
 * name on screen — which is exactly how the three Visualize mode tabs lost their tooltips (they
 * carry `.sch-tb-lbl-never`, and it was `display: none` — innerText-empty — until the a11y fix
 * changed it to a clipped label, Oleh spotted it 2026-07-24). Boxes of 1px or less are treated as
 * not drawn, which covers both recipes: `display: none` has no box at all, the clip recipe has 1×1.
 */
function paintedText(el: HTMLElement): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) { out += node.nodeValue ?? ''; continue; }
    if (!(node instanceof HTMLElement)) continue;
    if (node.offsetWidth <= 1 && node.offsetHeight <= 1) continue;
    out += paintedText(node);
  }
  return out;
}

/**
 * A tooltip NAMES a control that has no visible label (the catalog's rule) — so when the trigger
 * already shows the same words, the bubble is pure noise and is suppressed.
 *
 * This is what makes the sidebar behave: expanded, each item renders its label and the hint would
 * just repeat it; collapsed, the label span is not drawn, the painted text goes empty, and the
 * tooltip is the only thing naming the icon. No state flag, no sidebar-specific branch — and every
 * other control in the app that carries a redundant hint stops nagging too.
 */
const labelIsRedundant = (el: HTMLElement, tip: string) => {
  const t = tip.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  const visible = paintedText(el).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!visible) return false;
  // Text that is visually CUT OFF still reads whole in innerText, so a hint revealing a truncated
  // value must survive — that is the one case where repeating the label is the entire point.
  if (el.scrollWidth > el.clientWidth + 1) return false;
  // An ECHO — and only an echo. Anything looser makes suppression depend on CUSTOMER DATA, because
  // the app is full of one-word tips (Open / Edit / Close / Back) that can appear inside a base or
  // table someone named themselves. `includes` broke on "Openside CRM"; plain `startsWith` still
  // broke on "Open deals". So the only slack allowed is the trigger's own COUNT BADGE — "Inbox 4",
  // "Docs 12" — i.e. the remainder must be a number, never another word.
  if (visible === t) return true;
  if (!visible.startsWith(`${t} `)) return false;
  return /^\d[\d,.\s+k]*$/.test(visible.slice(t.length).trim());
};

/** A trigger is any `[data-tip]` that isn't forced-open and isn't just repeating its own label. */
const triggerFrom = (t: EventTarget | null): HTMLElement | null => {
  const el = (t as HTMLElement | null)?.closest?.<HTMLElement>('[data-tip]');
  if (!el || el.classList.contains('tooltip-open')) return null;
  // Short-circuit before the redundancy test: measuring boxes forces a layout flush, and pointerover
  // fires on every crossing between a trigger's own children.
  if (el === current) return el;
  return labelIsRedundant(el, el.dataset.tip || '') ? null : el;
};

export function wireTooltips() {
  // The guard lives on `window`, not on <html>: Astro's ClientRouter rewrites the root element's
  // attributes on every client-side navigation, so a dataset flag would come back false and a
  // re-executed script would bind a second set of listeners.
  const w = window as Window & { __ttWired?: boolean };
  if (w.__ttWired) return;
  w.__ttWired = true;

  // Delegated on the document, so it covers markup injected at runtime (panel bodies, grid rows,
  // the ＋ pickers) without any per-surface wiring.
  document.addEventListener('pointerover', (ev) => {
    const el = triggerFrom(ev.target);
    if (el === current) return;
    if (el) show(el); else if (current) hide();
  });
  document.addEventListener('pointerdown', hide);   // a click has its own feedback; the hint is done
  document.addEventListener('focusin', (ev) => {
    const el = triggerFrom(ev.target);
    if (el) show(el); else if (current) hide();
  });
  document.addEventListener('focusout', hide);
  // Escape dismisses the hint — but ONLY when one is up. `hide()` used to run unconditionally on
  // every Escape in the app, which as a stack entry would consume the press and leave the panel or
  // sheet the user meant to close still open. `current` is the honest answer to "is there a hint".
  pushEscape(escapeEntry);
  // Capture, because the scroll that matters is usually an inner container's, not the page's.
  document.addEventListener('scroll', () => { if (current) hide(); }, { capture: true, passive: true });
  window.addEventListener('resize', hide, { passive: true });
  // A view transition throws the trigger away; the bubble must not outlive it.
  document.addEventListener('astro:before-swap', hide);
}

wireTooltips();
