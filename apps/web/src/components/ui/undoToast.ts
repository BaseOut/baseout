/**
 * The undo toast, as a callable — catalog `pattern-undo-toast`.
 *
 * WHY THIS EXISTS. The pattern had implementations but no shared one: `PanelHost.astro` owns
 * `.ph-undo` and `EntityPanel.astro` carries its own, and BOTH are private to a component that a
 * list page has no reason to mount. `/reports` mounts no `PanelHost` (see `splitView.ts:119`), so
 * D06's "report deletion shows an undo toast" had no toast to call. Mounting a panel host on a list
 * page to obtain its side effect would be worse than the problem.
 *
 * So this is the pattern's first STANDALONE home: `UndoToast.astro` renders the markup once per
 * page, this module drives it. The two in-component copies should fold into it — that is a
 * `PanelHost` / `EntityPanel` change, outside this wave's file set, and it is recorded in
 * `audit/PARKED.md` P17 rather than attempted here.
 *
 * Behaviour is the catalog's, not a re-invention: outcome in the PAST TENSE, a ghost Undo button,
 * a 2px bar that DRAINS left-to-right over exactly the dismiss window (`UNDO_MS` feeds both the
 * animation and the timer, so they cannot drift), bottom-centre placement, and the bar restarted by
 * animation:none → reflow → re-assign so a second toast never opens on a finished animation.
 *
 * Lives in `.ts` on purpose: `astro check` never walks `apps/web` `<script>` blocks (see the memory
 * note "typecheck is BLIND to .astro scripts"), so behaviour that matters goes where `tsc --strict`
 * can see it.
 */

/** Dismiss window. Matches `PanelHost`'s UNDO_MS so the two toasts feel like one component. */
export const UNDO_MS = 5000;

export interface UndoAction {
  /** Button label — a verb the user recognises, normally "Undo". */
  label: string;
  /** What running it does. Called at most once; the toast closes itself first. */
  run: () => void;
}

/**
 * THERE IS ONE TOAST, SO THERE IS ONE PENDING COMMIT — and it must not be lost when a second toast
 * supersedes the first.
 *
 * `onExpire` is where the caller COMMITS (issues the DELETE, in production). The first version
 * cleared the timer when a new toast opened and dropped the previous callback on the floor: delete
 * report A, then delete report B inside A's five-second window, and A's row was gone from the DOM
 * while A's commit never ran — a report that looks deleted and is not. So the pending callback is
 * held here and FLUSHED SYNCHRONOUSLY before the new toast installs itself.
 *
 * Supersession flushes; taking the action does not, and neither does an ordinary hide. Undo means
 * the outcome was reversed, so committing it would be the exact inversion of what the user asked
 * for. `takePending()` is therefore the only way the reference leaves this module: whoever reads it
 * clears it, so a callback can never run twice.
 */
let timer = 0;
let pendingCommit: (() => void) | null = null;

function el(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-undo-toast]');
}

/** Read-and-clear, so a pending commit runs at most once whichever path reaches it. */
function takePending(): (() => void) | null {
  const p = pendingCommit;
  pendingCommit = null;
  return p;
}

/**
 * Hide the toast WITHOUT committing. This is the Undo path and the ordinary dismiss: the outcome
 * either was reversed or is being abandoned, and neither is a reason to commit it.
 */
export function hideUndoToast(): void {
  window.clearTimeout(timer);
  takePending();
  const root = el();
  if (!root) return;
  root.hidden = true;
}

/**
 * Show the toast.
 *
 * @param label   The outcome, past tense ("Weekly Ops Report deleted").
 * @param action  The reversal, or `null` for a statement of fact — a countdown on a fact promises a
 *                choice the user does not have, so the bar is drawn only when an action exists.
 * @param onExpire Runs when the window closes WITHOUT the action being taken. This is what makes the
 *                deletion provisional rather than a lie: the caller commits here, not on confirm.
 */
export function showUndoToast(label: string, action: UndoAction | null, onExpire?: () => void): void {
  const root = el();
  if (!root) return;

  // SUPERSESSION FLUSHES. The window that is about to be cut short still ended without its Undo
  // being taken, so its outcome stands and its commit is due now. Synchronous and before anything
  // else here, so the new toast cannot be mistaken for the old one's confirmation.
  window.clearTimeout(timer);
  takePending()?.();

  const labelEl = root.querySelector<HTMLElement>('[data-undo-toast-label]');
  if (labelEl) labelEl.textContent = label;

  const btn = root.querySelector<HTMLButtonElement>('[data-undo-toast-act]');
  if (btn) {
    btn.hidden = !action;
    btn.textContent = action?.label ?? '';
    btn.onclick = action
      ? () => {
          hideUndoToast();
          action.run();
        }
      : null;
  }

  const icon = root.querySelector<HTMLElement>('[data-undo-toast-ic]');
  // Let the icon name the ACTION (rotate-ccw = Undo), never merely the fact that one exists.
  if (icon) icon.className = `iconify ${action ? 'lucide--rotate-ccw' : 'lucide--info'} size-4`;

  root.hidden = false;

  // The bar is a DEADLINE: drawn only when there is an action to be late for. A countdown on a
  // statement of fact promises a choice the reader does not have.
  const bar = root.querySelector<HTMLElement>('[data-undo-toast-bar]');
  if (bar) {
    bar.style.display = action ? '' : 'none';
    // Restart it, or a second toast opens on an already-finished animation and shows an empty bar.
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = action ? `baseout-undo-countdown ${UNDO_MS}ms linear forwards` : 'none';
  }

  pendingCommit = onExpire ?? null;
  timer = window.setTimeout(() => {
    // Read the callback BEFORE hiding: `hideUndoToast` clears the pending commit (it is the Undo
    // path), so taking it first is what keeps expiry and Undo two different outcomes.
    const commit = takePending();
    hideUndoToast();
    commit?.();
  }, UNDO_MS);
}
