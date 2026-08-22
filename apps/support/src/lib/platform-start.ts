/**
 * The welcome page's platform chooser, in both of its variants.
 *
 * IT WRITES THE SAME KEY THE SIDEBAR FILTER READS, and that is the whole trick: there is one piece
 * of state for "which platforms is this reader interested in", and several surfaces that set it. A
 * chooser with its own memory would be a second answer to one question, and the two would disagree
 * the first time somebody used both. That is also why switching variant mid-session cannot produce
 * a contradictory state: the variant decides how the choice is made, never what the choice is.
 *
 * ── THE DOOR (`reactive`) ────────────────────────────────────────────────────────────────────
 * IT DOES NOT PREVENT THE NAVIGATION. The card is a real link to that platform's connecting page,
 * so it works with the script blocked, opens in a new tab on a middle click, and shows its target
 * in the status bar. The handler only writes the preference on the way out. A handler that called
 * `preventDefault` and navigated itself would break all three of those for no gain.
 *
 * ── THE SELECTOR (`filter`) ──────────────────────────────────────────────────────────────────
 * IT GOES THROUGH `writePlatformPreference`, not through `localStorage` directly, because the point
 * of this variant is that everything below reacts WITHOUT A RELOAD: that function is what fires
 * `FILTER_EVENT`, and `landing-strip.ts` (the steps and the directory), `platform-filter.ts` (the
 * sidebar) and the search modal are all already listening for it. Writing storage by hand here
 * would leave every one of them showing last page-load's answer.
 *
 * A SELECTED CARD DOES NOT DESELECT. Three cards narrowing to one is a radio group, and a radio
 * that turns itself off on a second press is how somebody loses their choice by double-clicking.
 * Widening back to all three is the separate, explicit control in the foot of the block.
 *
 * IT REWRITES `?platform=` THE WAY `platform-filter.ts` DOES, and for two reasons. First, that
 * parameter BEATS storage in `readPlatformPreference`, so a landing opened from a shared
 * `?platform=notion` link would otherwise snap back to Notion on the next load however many times
 * the reader pressed Airtable. Second, it makes the landing itself linkable in a chosen state,
 * which is what the client needs to pin one for review.
 *
 * IT LISTENS TO `FILTER_EVENT` TOO, so the cards follow a choice made anywhere else on the page —
 * the search modal carries the same chips and is one keystroke away on this screen.
 *
 * THE PRESSED PAINT IS NOT DONE HERE. `PlatformStart.astro` keys it to `html[data-shot-platform]`,
 * which a pre-paint inline script stamps before the markup is parsed, so the right card is lit at
 * first paint rather than one module-load later. What this file maintains is `aria-pressed`, which
 * is what a screen reader reads and which no stylesheet can set.
 *
 * IN A .ts FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
import {
  FILTER_EVENT,
  FILTER_KEY,
  PLATFORM_IDS,
  readPlatformPreference,
  writePlatformPreference,
  type PlatformId,
} from './platforms';

const isPlatform = (v: string): v is PlatformId => (PLATFORM_IDS as string[]).includes(v);

/** The one platform the preference names, or null when it names none or several. */
function only(ids: Iterable<PlatformId>): PlatformId | null {
  const list = [...ids];
  return list.length === 1 ? list[0] : null;
}

function paint(root: HTMLElement, id: PlatformId | null): void {
  for (const card of root.querySelectorAll<HTMLButtonElement>('[data-platform-start-select]')) {
    card.setAttribute('aria-pressed', String(card.dataset.platformStartSelect === id));
  }
}

/** Keeps the address bar in step, so a reload and a shared link agree with what is on screen. */
function stampUrl(on: Set<PlatformId>): void {
  const url = new URL(window.location.href);
  if (on.size === PLATFORM_IDS.length) url.searchParams.delete('platform');
  else url.searchParams.set('platform', [...on].join(','));
  window.history.replaceState(null, '', url);
}

export function mountPlatformStart(): void {
  const found = document.querySelector<HTMLElement>('[data-platform-start]');
  if (!found) return;
  /* Captured after the guard: TypeScript loses the narrowing across the closures below. */
  const root: HTMLElement = found;

  const stored = readPlatformPreference();
  paint(root, stored ? only(stored) : null);

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const door = target.closest<HTMLAnchorElement>('[data-platform-start-pick]');
    if (door) {
      const id = door.dataset.platformStartPick;
      if (!id || !isPlatform(id)) return;
      try {
        /* Narrowed to the one they picked, not added to what was there. Someone answering "which
           platform are you backing up" has told us the others are noise; leaving the rest on would
           make the choice look like it did nothing. The sidebar says what is hidden on every page
           afterwards, and offers one click back.
           Storage directly rather than `writePlatformPreference`: we are leaving this document, so
           there is nothing left on it that needs telling. */
        window.localStorage.setItem(FILTER_KEY, JSON.stringify([id]));
      } catch {
        /* storage disabled: the link still goes to the right page, which is most of the value */
      }
      return;
    }

    const pick = target.closest<HTMLButtonElement>('[data-platform-start-select]');
    if (pick) {
      const id = pick.dataset.platformStartSelect;
      if (!id || !isPlatform(id)) return;
      if (pick.getAttribute('aria-pressed') === 'true') return;
      const on = new Set<PlatformId>([id]);
      writePlatformPreference(on);
      stampUrl(on);
      return;
    }

    if (target.closest('[data-platform-start-clear]')) {
      const on = new Set<PlatformId>(PLATFORM_IDS);
      writePlatformPreference(on);
      stampUrl(on);
    }
  });

  /* Not called back by our own writes doing damage: `paint` only sets an attribute, so the extra
     pass this causes after a click is idempotent. */
  document.addEventListener(FILTER_EVENT, (e) => {
    const ids = (e as CustomEvent<string[]>).detail;
    if (!Array.isArray(ids)) return;
    paint(root, only(ids.filter(isPlatform)));
  });
}
