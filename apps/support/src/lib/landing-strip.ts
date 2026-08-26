/**
 * The landing's reaction to the platforms the reader has named — the three-step path's nouns, and
 * which platform cards the strip draws.
 *
 * THE CLIENT'S OWN COMPLAINT is what this answers, in his words: "we have some selector, and it
 * just picks where to start the integration". Until now the chooser wrote the site-wide preference
 * and navigated away, and every word below it on the same page ignored the answer. A control whose
 * only visible effect happens on another page is a control people stop trusting.
 *
 * ALMOST NONE OF THE WORK HAPPENS HERE, and that is deliberate. Every reading of every sentence and
 * every frame is server-rendered, and which one shows is decided by ONE attribute on `<html>` plus
 * a stylesheet. So this module sets an attribute, and the browser does the rest with no reflow of
 * text it has to measure and no flash of the wrong noun. The `href` is the one thing CSS cannot
 * carry, so it is the one thing written by hand below.
 *
 * IT LISTENS TO `FILTER_EVENT` ON `document`, exactly as `platform-filter.ts` and the search modal
 * do, because there is ONE piece of state called "which platforms is this reader interested in".
 * A second copy would disagree with the first the moment somebody used both surfaces, and each
 * would look correct on its own.
 *
 * ONE PLATFORM, OR NONE, FOR THE NOUNS. The preference is a SET: a reader can have two platforms
 * on. The path re-labels only when the set names exactly one, because "which Bases or Spaces to
 * back up" is not a sentence, and a reader who kept two on has not told us whose nouns are theirs.
 * Two selected reads as none here, which is the neutral copy, and it is true for all three.
 *
 * THE CARD STRIP IS THE OTHER HALF, ADDED 2026-08-21, and it has the opposite arithmetic: it draws
 * a door for EVERY platform the reader has, so two selected draws two. The two rules are not in
 * tension — a sentence has to pick one vocabulary and a list does not.
 *
 * IN A .ts FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
import {
  currentPlatforms,
  onPlatformsChange,
  type PlatformId,
} from './platforms';
import { CARDS_PARAM } from './card-count';
import { STEPS, stepHref } from './landing-steps';

/** The attribute the stylesheet reads (`data-bo-platform`). Absent means the neutral reading.
 *  It was `shotPlatform` until 2026-08-21, named after the two-treatment switch on this page; that
 *  switch is deleted and this was never part of it, so it now carries the portal's own prefix. */
const ATTR = 'boPlatform';

/** The plural one (`data-bo-platforms`), a SPACE-SEPARATED list so `[~=]` can match one id. */
const ATTR_MANY = 'boPlatforms';

/** The card strip's visible count, read by `.ps-grid`'s `max-width` in `PlatformStart.astro`. */
const SHOWN_VAR = '--ps-shown';

function only(ids: PlatformId[]): PlatformId | null {
  return ids.length === 1 ? ids[0] : null;
}

/**
 * THE STEPS AND THE GLOSSARY, which re-label at EXACTLY ONE platform and are neutral otherwise.
 */
function applyNouns(id: PlatformId | null): void {
  const root = document.documentElement;
  if (id) root.dataset[ATTR] = id;
  else delete root.dataset[ATTR];

  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-step-link]')) {
    const step = STEPS.find((s) => String(s.n) === a.dataset.stepLink);
    if (step) a.setAttribute('href', stepHref(step, id));
  }
}

/**
 * THE CARD STRIP, which draws a DOOR for each platform the reader has, and every door when they
 * have not narrowed. Oleh, 2026-08-21: a card for a platform they excluded has nothing to offer.
 *
 * IT IS ONE ATTRIBUTE AND A CSS VARIABLE, and nothing here touches a card. The rules that hide and
 * reveal are generated in `PlatformStart.astro` from `DOCUMENTED_PLATFORM_IDS`, so this function
 * cannot disagree with the pre-paint script that stamps the same two things before first paint —
 * they write the identical state and the stylesheet is the only thing that acts on it.
 *
 * THE DOCUMENTED SET IS READ OFF THE CARDS THEMSELVES, not imported. `lib/documented-platforms.ts`
 * derives it with `import.meta.glob` and says in its own header that it is for server-rendered
 * components only — importing it here would pull markdown modules into a client bundle. Reading
 * `[data-ps-plat]` is also the stronger guarantee: the ids this narrows by are, by construction,
 * exactly the cards that exist in the page.
 *
 * THE EMPTY END DRAWS EVERYTHING, and it is reached three ways: the reader has never chosen, the
 * reader pressed `None` (the picker broadcasts the effective set, which is every id), or the choice
 * names no documented platform at all (`?platform=smartsheet`). All three land on the same branch
 * below, because a block that empties itself is the one failure this must not have.
 */
function applyStrip(on: Set<PlatformId>): void {
  const root = document.documentElement;
  const drawn = [...document.querySelectorAll<HTMLElement>('[data-ps-plat]')]
    .map((el) => el.dataset.psPlat)
    .filter((id): id is string => Boolean(id));
  if (!drawn.length) return;
  const shown = drawn.filter((id) => on.has(id as PlatformId));

  if (!shown.length || shown.length === drawn.length) {
    delete root.dataset[ATTR_MANY];
    root.style.removeProperty(SHOWN_VAR);
    return;
  }
  root.dataset[ATTR_MANY] = shown.join(' ');
  root.style.setProperty(SHOWN_VAR, String(shown.length));
}

export function mountLandingStrip(): void {
  /* Every other page in the portal loads this bundle too; leaving early is cheaper than a selector
     that finds nothing three times per navigation. */
  if (!document.querySelector('[data-step-link]')) return;

  /* `?cards=` OWNS THE STRIP WHILE IT IS PRESENT. It is the layout-review parameter: it pads or
     caps the strip so the row at one, five and eight platforms can be looked at, and a narrowing
     that also hid cards would leave nobody able to say which authority drew what. The test is the
     parameter's PRESENCE, not a valid value, because the pre-paint script makes the same test and
     two readers of one rule must not be able to disagree. The nouns still follow the reader. */
  const strip = !new URLSearchParams(window.location.search).has(CARDS_PARAM);

  const on = currentPlatforms();
  applyNouns(only([...on]));
  if (strip) applyStrip(on);

  /* ONE LISTENER FAMILY, the same `onPlatformsChange` the sidebar, the search modal and the chat
     use: it validates the payload once and never delivers an empty set, so the hero picker, a card
     on its way out and the sidebar all reach this page through the same door. */
  onPlatformsChange((next) => {
    applyNouns(only([...next]));
    if (strip) applyStrip(next);
  });
}
