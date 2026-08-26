/**
 * The welcome page's platform chooser.
 *
 * IT WRITES THE SAME KEY THE SIDEBAR FILTER READS, and that is the whole trick: there is one piece
 * of state for "which platforms is this reader interested in", and several surfaces that set it. A
 * chooser with its own memory would be a second answer to one question, and the two would disagree
 * the first time somebody used both.
 *
 * ── A CARD IS A DOOR, AND SINCE 2026-08-21 THAT IS ALL IT IS ─────────────────────────────────
 * IT DOES NOT PREVENT THE NAVIGATION. The card is a real link to that platform's connecting page,
 * so it works with the script blocked, opens in a new tab on a middle click, and shows its target
 * in the status bar. The handler only writes the preference on the way out. A handler that called
 * `preventDefault` and navigated itself would break all three of those for no gain.
 *
 * THE SELECTOR HALF IS DELETED WITH THE `filter` TREATMENT. It was a `<button>` that narrowed in
 * place, and it lost on one measured point: a single-select control writing a multi-select
 * preference (the argument is in `components/landing/LandingBody.astro`). Scoping without leaving
 * the page is now the shared `PlatformPicker` in the hero, which is the same multi-select every
 * other surface of the portal draws — so `writePlatformPreference`, the `FILTER_EVENT` listener,
 * the `aria-pressed` paint and the `?platform=` stamp all leave with it. Nothing here needs to
 * announce a change any more, because nothing here changes anything without navigating.
 *
 * IN A .ts FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
import { FILTER_KEY, PLATFORM_IDS, type PlatformId } from './platforms';

const isPlatform = (v: string): v is PlatformId => (PLATFORM_IDS as string[]).includes(v);

export function mountPlatformStart(): void {
  const root = document.querySelector<HTMLElement>('[data-platform-start]');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const door = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-platform-start-pick]');
    if (!door) return;
    const id = door.dataset.platformStartPick;
    if (!id || !isPlatform(id)) return;
    try {
      /* Narrowed to the one they picked, not added to what was there. Someone walking through a
         door marked Notion has told us the others are noise for now; leaving the rest on would make
         the choice look like it did nothing. The sidebar says what is hidden on every page
         afterwards, and its picker offers every platform back in one click.
         Storage directly rather than `writePlatformPreference`: we are leaving this document, so
         there is nothing left on it that needs telling. */
      window.localStorage.setItem(FILTER_KEY, JSON.stringify([id]));
    } catch {
      /* storage disabled: the link still goes to the right page, which is most of the value */
    }
  });
}
