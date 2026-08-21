/**
 * copyId — the shared behaviour behind catalog `pattern-copy-id`.
 *
 * The markup is three lines of HTML, but the BEHAVIOUR had been retyped in the entity panel, the
 * record drawer and the Data changelog, and the confirmation (icon swaps to a check for ~1.1s,
 * then swaps back) is the part that drifts. This is the backups trail's copy of it, extracted to a
 * `.ts` on purpose: `astro check` never walks an `.astro` <script> block, so a controller left
 * inline is invisible to every gate in the repo.
 *
 * Contract: any element carrying `data-copy-id="<value>"` inside `root` copies that value and
 * confirms in place. No toast — copying is not an event worth a page-level announcement.
 *
 * PROMOTION RECONCILE (apps/web): the fork types `root` as `ParentNode`, but under the Cloudflare
 * worker types `ParentNode` resolves to workerd's HTMLRewriter global (not lib.dom), so passing a
 * DOM `HTMLElement` fails to typecheck. `HTMLElement` is the convention the sibling `wireTableSort`
 * already uses — a DOM-type-shadow rewrite, never `any`.
 */
const CONFIRM_MS = 1100;

export function wireCopyId(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-copy-id]').forEach((btn) => {
    if (btn.dataset.copyWired === '1') return;
    btn.dataset.copyWired = '1';
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const value = btn.dataset.copyId;
      if (!value) return;
      void navigator.clipboard?.writeText(value);
      const icon = btn.querySelector<HTMLElement>('.iconify');
      if (!icon) return;
      btn.classList.add('is-copied');
      icon.className = 'iconify lucide--check size-3.5';
      window.setTimeout(() => {
        btn.classList.remove('is-copied');
        icon.className = 'iconify lucide--copy size-3.5';
      }, CONFIRM_MS);
    });
  });
}
