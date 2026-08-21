/**
 * The ONE writer for `components/ui/Alert.astro` — and the reason the vessel exists at all.
 *
 * ─── WHY THE ORDER OF THESE TWO LINES IS THE WHOLE POINT (audit D42, census 2026-08-14) ───
 *
 * `role="alert"` is an implicit `aria-live="assertive"` region. A live region announces on
 * **insertion into the accessibility tree**, or on a **text change while it is already in the
 * tree**. It does NOT announce merely because it became visible — and while an element carries
 * `hidden` (or Tailwind's `hidden` class) it is `display: none`, i.e. OUT of the tree.
 *
 * The measured census across this repo: the role is present on **79 elements and doing its job on
 * at most 7**. Of the 17 sites that have a writer at all, **13 write the text while the vessel is
 * still hidden and then reveal it** — the mutation lands outside the tree, so nothing hears it, and
 * the reveal then inserts a region that already has its content, which announces nothing either.
 * Nobody chose that ordering; it is a per-handler accident across 17 hand-rolled writers. Putting
 * the order in ONE function is what repairs every consumer at once.
 *
 * So: **un-hide → flush → write.** The forced `offsetHeight` read between the two is not a tidy-up.
 * `classList.remove('hidden')` / clearing `hidden` only queues a style change; without flushing it
 * the browser can coalesce the reveal and the text mutation into a single record that reads as
 * "a region appeared with content in it", which is the silent case again. Reading `offsetHeight`
 * commits the element to its display first, so the text lands as a change to a region that is
 * already live. One forced reflow, on a path a human just triggered by pressing a button that
 * failed — the cost is invisible and the alternative is a wrong announcement.
 *
 * `lib/auth-utils.ts`'s `showFormError` is the same rule for the *inline form* vessel (D32); this
 * file is the banner vessel's copy of it. They are deliberately two functions because they own two
 * different element shapes — see the `alert` catalog entry, "Which 79".
 *
 * ─── AND WHY IT WRITES ONLY ON CHANGE ───
 *
 * `lib/restore/controller.ts:65-69` assigns `textContent` unconditionally inside a `render()` with
 * 13 call sites, so **every click in the restore builder re-announces the same warning sentence**
 * from inside `role="alert"`. Comparing before assigning costs one string compare and removes a
 * whole class of that defect. A re-refusal with a genuinely NEW message still announces, because
 * a text change inside a region that is in the tree is the case live regions handle natively.
 */

/** The element that holds the message text inside an `Alert.astro`, or the vessel itself. */
function textNode(el: HTMLElement): HTMLElement {
  return el.querySelector<HTMLElement>('[data-alert-text]') ?? el;
}

function isConcealed(el: HTMLElement): boolean {
  return el.hidden || el.classList.contains('hidden');
}

/**
 * Reveal an alert and (optionally) give it a new message, in the only order that announces.
 * Safe to call when it is already visible — the reveal half is skipped and the write half is
 * exactly the "text change inside a live region" case.
 */
export function showAlert(el: HTMLElement | null | undefined, message?: string): void {
  if (!el) return;
  if (isConcealed(el)) {
    el.hidden = false;
    el.classList.remove('hidden');
    void el.offsetHeight; // flush the reveal so the region is LIVE before the text lands
  }
  if (message !== undefined) setAlertMessage(el, message);
}

/**
 * Write a message into an already-visible alert. **Write only on change** — see the header.
 * Returns true when the text actually changed (i.e. when an announcement is expected).
 */
export function setAlertMessage(el: HTMLElement | null | undefined, message: string): boolean {
  if (!el) return false;
  const target = textNode(el);
  if (target.textContent === message) return false;
  target.textContent = message;
  return true;
}

/** Conceal an alert. Clearing the text is deliberate: a stale sentence must not re-announce later. */
export function hideAlert(el: HTMLElement | null | undefined, clearText = false): void {
  if (!el) return;
  el.hidden = true;
  el.classList.add('hidden');
  if (clearText) textNode(el).textContent = '';
}

let dismissWired = false;

/**
 * One delegated listener for every `dismissible` Alert on the page. Astro hoists a component's
 * `<script>` once per page no matter how many instances render, but the module-level guard makes
 * a second manual call harmless.
 */
export function wireAlertDismiss(doc: Document = document): void {
  if (dismissWired) return;
  dismissWired = true;
  doc.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-ui-alert-dismiss]');
    if (!btn) return;
    const vessel = btn.closest<HTMLElement>('[data-ui-alert]');
    if (!vessel) return;
    hideAlert(vessel);
    vessel.dispatchEvent(new CustomEvent('uialertdismiss', { bubbles: true }));
  });
}
