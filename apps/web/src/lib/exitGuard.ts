/**
 * exitGuard — ONE exit interceptor for the surfaces that can lose AUTHORED work.
 *
 * ─── WHERE THIS CAME FROM ───
 *
 * `IntegrationsSetupWizard.astro:862-931` has carried a working interceptor since D06 item 5. It was
 * surface-agnostic in everything but its selectors, and D30's second amendment rules that it should
 * be lifted here and mounted on the two other surfaces that lose work with no draft behind it:
 * **`SchemaDocs`** (a whole authored document) and **`ReportDefinitionView`** (a report definition
 * that already computes `dirty` and offered a plain `<a href="/reports">Cancel</a>` beside the words
 * `Unsaved changes`). Those two plus the wizard are the COMPLETE set.
 *
 * ─── WHERE IT DOES NOT BELONG (D30, amendment 2) ───
 *
 * Not app-wide, and specifically NOT on the registry detail pages or the entity panel. Those lose one
 * field's worth of typing, for which `registryEditMode.ts`'s discard-on-exit is the right contract and
 * a dialog is noise. `beforeunload` renders browser chrome whose copy the charter's tone rules cannot
 * reach; mounting it everywhere would be the app shouting where it currently whispers. It is opt-in
 * here (`beforeUnload: true`) and only the two document-shaped surfaces pass it.
 *
 * ─── THE THREE EXITS ───
 *
 * 1. **A click on a link.** Delegated on `document` in the CAPTURE phase, so a sidebar link — which
 *    the surface does not own — is guarded exactly like one it does. Inside `root` only links tagged
 *    with `exitAttr` count, so the dialog's own confirm and every in-surface link stay free (a guard
 *    that blocks its own exit traps the user inside it). Modified clicks, new tabs, downloads,
 *    fragments, cross-origin and same-URL links are all left alone: none of them is this page
 *    ending.
 * 2. **Browser Back** (`popstate`). New here — the wizard's guard never saw it, so Back walked
 *    straight past the dialog the wizard had just built. `popstate` cannot be cancelled after the
 *    fact, so the guard ARMS by pushing a duplicate entry for the current URL as soon as there is
 *    something to lose; Back then lands on that duplicate, the handler re-arms and asks, and a
 *    confirmed exit runs `history.go(-2)` to land where Back was going in the first place.
 * 3. **Tab close / reload** (`beforeunload`, opt-in). The one exit a click interceptor cannot see.
 *    Losing an entire authored document to ⌘W is exactly the case the blunt browser dialog exists
 *    for, and it is the last resort, not the mechanism.
 *
 * The predicate is the caller's: it asks ONLY when there is something to lose. A dialog on a page
 * where nothing was typed is the ceremony that teaches people to dismiss dialogs unread.
 */

export interface ExitGuardOptions {
  /** The surface. Links inside it are exempt unless they carry `exitAttr`. */
  root: HTMLElement;
  /**
   * The id of the `ConfirmModal` to ask with — an id, NOT a node.
   *
   * A captured node goes stale: something on the page replaces or re-parents the dialog and every
   * later `showModal()` throws `The element is not in a Document`. That throw lands AFTER the click
   * has been prevented, so the user is left unable to leave at all — a guard that traps is strictly
   * worse than no guard. Resolving by id each time, and letting the exit through when nothing
   * resolves, is what makes the failure mode "no question asked" instead of "no way out".
   */
  dialogId: string;
  /** True when leaving now would destroy work. The guard is silent whenever this is false. */
  somethingToLose: () => boolean;
  /** Attribute marking an in-surface link as an exit. Default `data-exit-guard`. */
  exitAttr?: string;
  /** Also guard tab close / reload. Only the two document-shaped surfaces pass this. */
  beforeUnload?: boolean;
  /**
   * How to ask. The default opens `dialog` and calls `proceed()` when its footer returns
   * `'confirm'`. A surface that already owns one discard dialog (Docs asks the same question when
   * you switch documents) passes its own so there is ONE dialog and one pending action, not two.
   */
  onBlocked?: (proceed: () => void) => void;
}

export interface ExitGuardHandle {
  /**
   * Perform a navigation the guard must not question — a discard the surface has already confirmed
   * itself. Suppresses `beforeunload` for that navigation.
   */
  bypass(run: () => void): void;
}

export function wireExitGuard(options: ExitGuardOptions): ExitGuardHandle {
  const { root, dialogId, somethingToLose, exitAttr = 'data-exit-guard', beforeUnload = false } = options;
  const getDialog = () => document.getElementById(dialogId) as HTMLDialogElement | null;

  /** Set while an exit the guard itself sanctioned is in flight, so nothing re-asks about it. */
  let leaving = false;
  /** True once a duplicate history entry is in place, so Back has something to land on. */
  let armed = false;

  /**
   * ONE pending action, ONE listener. Not a `close` listener per ask: two exits can be attempted
   * before either dialog resolves (Back, then a link), and a listener per ask means the second
   * confirm runs BOTH proceeds — a navigation and a `history.go(-2)` racing each other, which lands
   * the user somewhere neither exit asked for. A later ask replaces the pending action instead of
   * stacking behind it.
   */
  let pendingProceed: (() => void) | null = null;

  const ask = options.onBlocked ?? ((proceed: () => void) => {
    const dialog = getDialog();
    if (!dialog) return;
    pendingProceed = proceed;
    if (dialog.open) return;
    dialog.returnValue = '';
    // PERSISTENT and idempotent, never `{ once: true }`: a one-shot listener is removed by ANY close
    // — including one this guard did not open — and the next confirm then reaches nothing, which
    // reads to the user as a dialog that agreed with them and did nothing. The dataset flag is what
    // keeps re-opening from stacking listeners.
    if (dialog.dataset.exitGuardWired !== '1') {
      dialog.dataset.exitGuardWired = '1';
      dialog.addEventListener('close', () => {
        const run = pendingProceed;
        pendingProceed = null;
        // Escape, the backdrop and Cancel all leave `returnValue` empty, which reads as "not
        // confirmed" without a special case (see ConfirmModal's own note).
        if (run && dialog.returnValue === 'confirm') run();
      });
    }
    dialog.showModal();
  });

  function bypass(run: () => void): void {
    leaving = true;
    run();
  }

  // ── 1. Links ─────────────────────────────────────────────────────────────────────────────────
  document.addEventListener('click', (ev) => {
    // Resolve the dialog BEFORE preventing anything: with no dialog to ask in, the honest outcome is
    // a plain navigation, not a click that goes nowhere.
    const dialog = getDialog();
    if (leaving || !dialog || dialog.open || !somethingToLose()) return;
    const me = ev as MouseEvent;
    // A middle/⌘/ctrl/shift/alt click opens a new tab and does not leave this page at all, so
    // guarding it would be a dialog about nothing.
    if (ev.defaultPrevented || me.button !== 0 || me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;
    const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    if (root.contains(a) && !a.hasAttribute(exitAttr)) return;
    const href = a.getAttribute('href') ?? '';
    if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download')) return;
    let url: URL;
    try {
      url = new URL(a.href, window.location.href);
    } catch {
      return; // a malformed href is not an exit this guard can reason about
    }
    // Another origin is the browser leaving, not the app navigating; and a link to where we already
    // are discards nothing.
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    ev.preventDefault();
    ask(() => bypass(() => { window.location.href = url.href; }));
  }, true);

  // ── 2. Browser Back ──────────────────────────────────────────────────────────────────────────
  /**
   * Push a duplicate of the current entry so Back has somewhere to land that is still this page.
   * Armed lazily — an untouched page must not add a history entry nobody asked for, which would make
   * Back need two presses on a surface with nothing at stake.
   */
  function arm(): void {
    if (armed || leaving || !somethingToLose()) return;
    try {
      history.pushState({ ...(history.state as object | null), exitGuard: true }, '', window.location.href);
      armed = true;
    } catch {
      // History is not something to break a keystroke over; the click and unload guards still hold.
    }
  }
  /**
   * Any typing or control change on the surface is the moment work starts existing — but the arming
   * has to happen AFTER the surface's own handler for that event, not before it.
   *
   * This listens in the capture phase (so a `stopPropagation` mid-tree cannot hide the event) and
   * defers the actual `arm()` by a task. Without the defer, `ReportDefinitionView` — whose predicate
   * reads the `Unsaved changes` element that its own `input` handler un-hides — reported "nothing to
   * lose" on the FIRST keystroke, because a capture listener on the root runs before the target's
   * own. Nothing was pushed, and Back on a one-keystroke edit left the page silently: the exact
   * defect this guard exists to remove, hiding inside the guard.
   */
  const armSoon = () => { window.setTimeout(arm, 0); };
  root.addEventListener('input', armSoon, true);
  root.addEventListener('change', armSoon, true);

  window.addEventListener('popstate', () => {
    if (leaving) return;
    if (!somethingToLose()) { armed = false; return; }
    // We are back on the real entry with the duplicate popped. Re-arm so the page stays put, then
    // ask. Confirming has to skip BOTH entries — the duplicate we just pushed and the real one — to
    // reach where Back was actually going.
    armed = false;
    arm();
    ask(() => bypass(() => { history.go(-2); }));
  });

  // ── 3. Tab close / reload ────────────────────────────────────────────────────────────────────
  if (beforeUnload) {
    window.addEventListener('beforeunload', (ev) => {
      if (leaving || !somethingToLose()) return;
      ev.preventDefault();
      // Chrome ignores the string and shows its own words; assigning it is what still arms the
      // prompt in older engines. The copy is not ours to write, which is why this is a last resort
      // and not the mechanism.
      ev.returnValue = '';
    });
  }

  return { bypass };
}
