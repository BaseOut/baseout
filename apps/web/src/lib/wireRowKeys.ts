/**
 * D46 — one clickable row, one keyboard implementation.
 *
 * A row that announces `role="button" tabindex="0"` and paints a focus ring has made a promise.
 * The three-line "Enter/Space → activate" block that keeps that promise was copied into eight
 * live listings and FORGOTTEN in the three report-body tables, which is the worst affordance
 * failure available: the row visibly claims to be actionable and is not. A ninth copy makes the
 * next omission inevitable, so this module is the only copy.
 *
 * WHY DELEGATION AND NOT A per-row LOOP. Five of the eight call sites re-render their tbody
 * (paging, sorting, filtering) and three of those attach listeners to the row nodes that existed
 * at init — every row painted afterwards is silently unwired. Listening on a stable root and
 * resolving the row with `closest()` at event time is the same three lines and survives a
 * re-render, so no call site has to remember to re-wire.
 *
 * WHY `skipInteractive` IS ON BY DEFAULT. A row is a big target that CONTAINS smaller ones — a
 * lead-cell `<a href>` (D46's other half), a `.row-actions` overflow menu, a location segment
 * that is a real `<button>`, and on two Schema tables a delete control wired to a ConfirmModal.
 * Enter on any of those is ITS activation, not the row's; without this the one keypress fires
 * both, which on those two tables means opening a confirm dialog AND running the row's own
 * navigation behind it. The default is the safe direction: the row stands down when the key
 * landed on something that can act for itself.
 */

export interface WireRowKeysOptions {
  /** Selector identifying a row, resolved with `closest()` from the key event's target. */
  rowSelector: string;
  /**
   * What Enter/Space does. Default: `row.click()` — correct wherever the row already carries a
   * click handler or an inline `onclick`. `ev` is passed so a call site can honour ⌘/Ctrl and
   * open beside, which two Data listings do.
   */
  onActivate?: (row: HTMLElement, ev: KeyboardEvent) => void;
  /**
   * Extra stand-down test, on top of the nested-interactive default. Return `true` to let the
   * key through untouched.
   */
  skip?: (ev: KeyboardEvent, row: HTMLElement) => boolean;
  /**
   * Ignore a key that landed on a nested control that can activate itself. Default `true`.
   * Turn it off only for a row whose interactive children must NOT act on their own.
   */
  skipInteractive?: boolean;
  /**
   * Only activate rows that currently declare `role="button"`. Default `true` — a table whose
   * rows are conditionally clickable (Reports) must not activate the non-clickable ones, and a
   * row that is genuinely a button always carries the role, so this costs the honest sites
   * nothing.
   */
  requireRole?: boolean;
  /** Keys that activate. Default `['Enter', ' ']`. */
  keys?: readonly string[];
}

/**
 * What counts as "a control inside the row", for the purpose of standing the row down.
 *
 * The tag list is not sufficient, and the two additions are not defensive — they close a defect
 * measured on `/reports` (batch 4, 2026-08-14). daisyUI renders a dropdown trigger as
 * `<div tabindex="0" role="button">`, which matches **none** of the tags below. So Enter on the
 * `⋯` overflow control inside a clickable row opened the menu **and** activated the row, which
 * navigates away — i.e. the menu was unreachable by keyboard on every list that has one. The
 * contrast that isolated it: the History table's Delivery dropdown is a real `<button>` and stood
 * down correctly in the same sweep.
 *
 * `[tabindex="-1"]` is excluded deliberately: that is the marker for something focusable only by
 * script (a panel sheet, a scroll container), not a control the user tabs to, and treating it as
 * one would stand the row down for its own container.
 */
const INTERACTIVE =
  'a[href],button,input,select,textarea,summary,[contenteditable="true"],' +
  '[role="button"],[role="menuitem"],[role="tab"],[tabindex]:not([tabindex="-1"])';

/**
 * Wire Enter/Space activation for every row under `root`, now and after any re-render.
 * Returns a disposer. Safe to call twice on the same root — the second call is a no-op, which is
 * what the four views that re-run their init on navigation rely on.
 */
export function wireRowKeys(root: HTMLElement, opts: WireRowKeysOptions): () => void {
  const {
    rowSelector,
    onActivate,
    skip,
    skipInteractive = true,
    requireRole = true,
    keys = ['Enter', ' '],
  } = opts;

  // Idempotence is keyed by the SELECTOR, not by the root: two listings can share one root
  // (the report body wires three tables inside one container) and each needs its own wire.
  const flag = `rowkeys:${rowSelector}`;
  const wired = (root.dataset.rowkeysWired || '').split('|');
  if (wired.includes(flag)) return () => {};
  root.dataset.rowkeysWired = [...wired.filter(Boolean), flag].join('|');

  const handler = (ev: KeyboardEvent) => {
    if (!keys.includes(ev.key)) return;
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    const row = target.closest<HTMLElement>(rowSelector);
    if (!row || !root.contains(row)) return;
    if (requireRole && row.getAttribute('role') !== 'button') return;
    if (skipInteractive) {
      // `ctl !== row` matters: a row that IS a real <button> matches INTERACTIVE itself, and it
      // must keep the UA's own activation rather than be skipped by its own test.
      const ctl = target.closest<HTMLElement>(INTERACTIVE);
      if (ctl && ctl !== row && row.contains(ctl)) return;
    }
    if (skip?.(ev, row)) return;
    ev.preventDefault();
    if (onActivate) onActivate(row, ev);
    else row.click();
  };

  root.addEventListener('keydown', handler);
  return () => {
    root.removeEventListener('keydown', handler);
    root.dataset.rowkeysWired = (root.dataset.rowkeysWired || '')
      .split('|')
      .filter((f) => f && f !== flag)
      .join('|');
  };
}
