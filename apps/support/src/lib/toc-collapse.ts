/**
 * The page-contents fold: a list button that opens the same card as a popover.
 *
 * Only meaningful while the chat drawer is open — that is when the contents give up their column
 * and become a control (see `components/PageSidebar.astro`). The CSS owns which of the two states
 * is showing; this file only owns the toggle, so there is one source of truth for the state and it
 * is the `data-chat` flag plus this one attribute.
 *
 * Extracted from the component because `astro check` does not walk `.astro` `<script>` blocks —
 * logic left inside one is invisible to every type gate we own.
 */
export function wireToc(): void {
  const root = document.querySelector<HTMLElement>('[data-toc-root]');
  const btn = root?.querySelector<HTMLButtonElement>('[data-toc-toggle]');
  if (!root || !btn) return;

  const set = (open: boolean) => {
    root.toggleAttribute('data-toc-open', open);
    btn.setAttribute('aria-expanded', String(open));
  };

  btn.addEventListener('click', () => set(!root.hasAttribute('data-toc-open')));

  /* Clicking a heading is navigation — the popover has done its job and should get out of the way.
     Anywhere else outside it dismisses too, which is what a popover is expected to do. */
  root.querySelector('[data-toc-card]')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) set(false);
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target as Node)) set(false);
  });

  /* CAPTURE phase, and it consumes the event. Escape is shared with the chat drawer, and both
     listeners sit on `document` — so which one wins came down to which module happened to execute
     first, and it was this one: the popover closed, the chat's listener then saw no popover and
     closed the conversation too. Capture runs before bubble whatever the registration order, and
     `stopImmediatePropagation` makes "innermost layer first" a rule rather than a coincidence. */
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !root.hasAttribute('data-toc-open')) return;
      e.stopImmediatePropagation();
      set(false);
      btn.focus();
    },
    { capture: true },
  );
}
