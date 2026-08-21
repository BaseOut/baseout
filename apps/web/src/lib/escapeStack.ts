/**
 * ONE Escape listener for the whole app.
 *
 * Seven modules had each added their own `document.addEventListener('keydown', …Escape…)`:
 * `PanelHost`, `entityPanelController`, `listSheet`, `tooltip`, `collapsingSearch`,
 * `schemaRelationships` and `DataBrowse`. Every one of them fires on the SAME keypress, because a
 * document listener cannot know that another document listener already handled it. So Escape with a
 * tooltip showing inside an open panel while a list sheet is open closed all three at once, and the
 * user got one dismissal for a press they meant to spend on the topmost thing. `listSheet.ts` has
 * carried a comment naming this as a deferred job since the day it was written.
 *
 * WHY THERE IS NO DEPTH TABLE, WHICH IS THE PART I EXPECTED TO NEED.
 *
 * The obvious design is an enum — tooltip 10, popover 20, panel 30, sheet 40 — and it is wrong. A
 * kind does not have a fixed depth: `DataBrowse`'s filter popover is ABOVE the panel when opened
 * from inside it and BELOW nothing when opened from the toolbar, and the same tooltip can belong to
 * a page header or to a control inside a drawer. Any number written into a module is a guess about a
 * containment it cannot see. Registration order is not a guess — a thing that opened later is, by
 * construction, on top of what was already open. So depth here is **when you pushed**, and the stack
 * is LIFO. Nothing to keep in sync, and a new surface gets correct ordering by existing.
 *
 * WHY A NATIVE `<dialog open>` OUTRANKS THE WHOLE STACK.
 *
 * Measured on /styleguide, 2026-08-15, rather than assumed:
 *
 *   dlg.showModal(); // → keydown Escape from inside
 *   { escapeReachedDocument: 1, dialogStillOpenWhenDocumentSawIt: true }
 *
 * Closing a modal is a DEFAULT ACTION, not a propagation stop. The keydown still bubbles to
 * `document`, and it arrives while `dialog[open]` is still true. Without the guard below, one Escape
 * dismisses the daisyUI modal AND whatever this stack has underneath it — which is every
 * ConfirmModal in the app, sitting inside panels and sheets. The guard stands the stack down and
 * lets the browser have the press.
 *
 * The exception is a handler that lives INSIDE the open dialog: it is above the dialog, not under
 * it, so it keeps its turn. Pass `withinDialog: true` for that case.
 */

export interface EscapeEntry {
  /**
   * Handle the press. Return `true` if it was consumed — the stack stops there and calls
   * `preventDefault()`. Return `false` for "not mine right now", which is what a handler whose
   * surface is currently closed must do, so the press falls through to the next one down.
   *
   * Returning `false` rather than unregistering is deliberate: most of these surfaces open and close
   * many times per page, and a handler that stays registered and answers honestly is far harder to
   * get wrong than one that must remember to push and pop in every branch.
   */
  onEscape: () => boolean;
  /**
   * This handler's surface lives inside a native `<dialog>`, so it must still run while one is open.
   * Default `false` — the safe direction, because the common case is a surface UNDER the dialog.
   */
  withinDialog?: boolean;
  /** Debug label, surfaced by `escapeStackDepth()`. Costs nothing and makes a bad order readable. */
  label: string;
}

const stack: EscapeEntry[] = [];
let wired = false;

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key !== 'Escape') return;
  // `defaultPrevented` — something closer to the target already claimed it (an element-scoped
  // handler on an inline editor, of which this app has several). Those are correct and stay.
  if (ev.defaultPrevented) return;

  const dialogOpen = !!document.querySelector('dialog[open]');

  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    if (dialogOpen && !entry.withinDialog) continue;
    let consumed = false;
    try {
      consumed = entry.onEscape();
    } catch (err) {
      // One broken handler must not strand Escape for every surface below it.
      // eslint-disable-next-line no-console
      console.error(`escapeStack: handler "${entry.label}" threw; continuing down the stack.`, err);
      continue;
    }
    if (consumed) {
      ev.preventDefault();
      return;
    }
  }
}

/**
 * Register a handler. Returns its disposer.
 *
 * Call this once per surface at wire-up time, not on open — see `onEscape` above for why a
 * long-lived handler that answers honestly beats a push/pop pair.
 */
export function pushEscape(entry: EscapeEntry): () => void {
  stack.push(entry);
  if (!wired) {
    document.addEventListener('keydown', onKeydown);
    wired = true;
  }
  return () => {
    const i = stack.indexOf(entry);
    if (i !== -1) stack.splice(i, 1);
  };
}

/**
 * Move an already-registered handler to the top — for a surface that is wired once but can be
 * re-opened above things that opened after it (a panel re-focused from the stack).
 */
export function raiseEscape(entry: EscapeEntry): void {
  const i = stack.indexOf(entry);
  if (i === -1 || i === stack.length - 1) return;
  stack.splice(i, 1);
  stack.push(entry);
}

/** Labels, top of stack last. For debugging an order that reads wrong. */
export function escapeStackDepth(): string[] {
  return stack.map((e) => e.label);
}
