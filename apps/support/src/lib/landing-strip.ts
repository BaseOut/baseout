/**
 * The landing strip's reaction to the platform the reader has named.
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
 * ONE PLATFORM, OR NONE. The preference is a SET: a reader can have two platforms on. The strip
 * re-labels only when the set names exactly one, because "which Bases or Spaces to back up" is not
 * a sentence, and a reader who kept two platforms on has not told us whose nouns are theirs. Two
 * selected reads as none here, which is the neutral copy, which is true for all three.
 *
 * IN A .ts FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
import {
  FILTER_EVENT,
  PLATFORM_IDS,
  readPlatformPreference,
  type PlatformId,
} from './platforms';
import { STEPS, stepHref } from './landing-steps';

const isPlatform = (v: string): v is PlatformId => (PLATFORM_IDS as string[]).includes(v);

/** The attribute the stylesheet reads. Absent means the neutral reading. */
const ATTR = 'shotPlatform';

function only(ids: PlatformId[]): PlatformId | null {
  return ids.length === 1 ? ids[0] : null;
}

function apply(id: PlatformId | null): void {
  const root = document.documentElement;
  if (id) root.dataset[ATTR] = id;
  else delete root.dataset[ATTR];

  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-step-link]')) {
    const step = STEPS.find((s) => String(s.n) === a.dataset.stepLink);
    if (step) a.setAttribute('href', stepHref(step, id));
  }
}

export function mountLandingStrip(): void {
  /* Every other page in the portal loads this bundle too; leaving early is cheaper than a selector
     that finds nothing three times per navigation. */
  if (!document.querySelector('[data-step-link]')) return;

  const stored = readPlatformPreference();
  apply(stored ? only([...stored]) : null);

  document.addEventListener(FILTER_EVENT, (e) => {
    const ids = (e as CustomEvent<string[]>).detail;
    if (!Array.isArray(ids)) return;
    apply(only(ids.filter(isPlatform)));
  });
}
