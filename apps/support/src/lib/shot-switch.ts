/**
 * The two-variant switch on `/`. A review instrument, and built to be deleted.
 *
 * WHAT IS BEING COMPARED. Both variants show the same three platform cards at the top of the page.
 * What differs is what a click on one of them DOES, and how far down the page the answer reaches:
 *
 *   reactive — a card is a DOOR. Clicking it narrows the site-wide platform preference to that one
 *              platform and leaves for that platform's connecting page, so the documentation the
 *              visitor lands on is already theirs. Everything on the landing itself is unchanged.
 *   filter   — a card is a SELECTOR. Clicking it narrows the same preference and the page STAYS:
 *              the three steps take that platform's nouns, that platform's own pages join the
 *              documentation directory below, and the sidebar, the search modal and the chat on
 *              every page opened afterwards are already narrowed to match.
 *
 * ONE PREFERENCE, TWO WAYS OF SETTING IT. Both variants write `bo-platforms` through
 * `writePlatformPreference`, so a reader who switches variant mid-session never lands in a
 * contradictory state: the variant decides how the choice is MADE, never what the choice IS.
 *
 * URL BEATS STORAGE, the same precedence `readPlatformPreference` uses and for the same reason: a
 * link that names a variant is somebody sending it to somebody, and last week's stored choice must
 * not silently rewrite what they were sent. `?shots=filter` pins one for the client.
 *
 * THE CHOICE IS AN ATTRIBUTE ON `<html>` AND NOTHING ELSE. Both variants are server-rendered and
 * the stylesheet decides which is seen, so switching costs no navigation and no re-render, and the
 * comparison stays a comparison of behaviours rather than of load times. A tiny inline script in
 * `LandingBody.astro` stamps the attribute BEFORE the strip is parsed, which is why the page cannot
 * flash the other variant on the way in; this module is the authority afterwards.
 *
 * IN A .ts FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
export type ShotVariant = 'filter' | 'reactive';

/** Duplicated verbatim by the pre-paint script in `LandingBody.astro`, which cannot import. */
export const SHOTS_KEY = 'bo-landing-shots';

/** Rendered first, and what the server renders when nobody has chosen. */
export const SHOTS_DEFAULT: ShotVariant = 'reactive';

/* THE LABEL IS ONE WORD. The previous switch on this page was told, explicitly, that it must not
   get in the way and that it needs no explanatory text; its first cut spelled the variant names out
   beside the letters and cost a full line of page height for it. What each word means is in the
   header above, not on the control. */
export const SHOT_VARIANTS: { key: ShotVariant; label: string }[] = [
  { key: 'reactive', label: 'Reactive' },
  { key: 'filter', label: 'Filter' },
];

const isVariant = (v: string | null | undefined): v is ShotVariant =>
  v === 'filter' || v === 'reactive';

function initial(): ShotVariant {
  const fromUrl = new URLSearchParams(window.location.search).get('shots');
  if (isVariant(fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem(SHOTS_KEY);
    if (isVariant(stored)) return stored;
  } catch {
    /* storage disabled: fall through to the default */
  }
  return SHOTS_DEFAULT;
}

function apply(v: ShotVariant): void {
  document.documentElement.dataset.shots = v;
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-shot-pick]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.shotPick === v));
  }
}

export function mountShotSwitch(): void {
  const root = document.querySelector('[data-shot-switch]');
  if (!root) return;

  let current = initial();
  apply(current);

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-shot-pick]');
    if (!btn) return;
    const next = btn.dataset.shotPick;
    if (!isVariant(next) || next === current) return;
    current = next;
    apply(current);
    try {
      window.localStorage.setItem(SHOTS_KEY, current);
    } catch {
      /* storage disabled: the choice simply does not survive the next load */
    }
    /* The address bar becomes the link to send. `replaceState`, so the back button still leaves the
       page rather than walking a history of preview toggles. */
    const url = new URL(window.location.href);
    url.searchParams.set('shots', current);
    window.history.replaceState(null, '', url);
  });
}
