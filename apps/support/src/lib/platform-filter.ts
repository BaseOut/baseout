/**
 * The platform filter's controller.
 *
 * WHAT IT TOUCHES: the chips' pressed state, the visibility of platform-tagged rows in the sidebar,
 * the `Show all` reset beside the control, and the notice on a page that the reader's own filter is
 * hiding. Nothing else. It never rewrites prose and never navigates.
 *
 * PRECEDENCE IS `?platform=` OVER STORAGE, which is the order Docusaurus arrived at in PR #8486
 * after shipping both separately. A link someone shares carries the platforms it was written for;
 * a reader's own remembered choice governs everywhere else. Getting this backwards means a shared
 * link silently shows the recipient a different page from the sender's.
 *
 * A PAGE IS NEVER REMOVED, ONLY MARKED. Hiding a row in the sidebar is safe; 404ing the page behind
 * it is not, because links to it exist outside this site and outside this filter. So a filtered
 * page still opens, says why it looks unexpected, and offers one click out.
 *
 * IN A .ts FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
import {
  PLATFORM_IDS,
  currentPlatforms,
  onPlatformsChange,
  samePlatforms,
  writePlatformPreference,
  uniquifyMark,
  type Mark,
  type PlatformId,
} from './platforms';

/* Counts rows across the whole page so two calls cannot mint the same suffix. */
let rowSeq = 0;

const isPlatform = (v: string): v is PlatformId => (PLATFORM_IDS as string[]).includes(v);

/* `readStored`, `fromUrl` and `write` used to live here. They moved to `lib/platforms.ts` when the
   search modal grew the same chips: two implementations of "which platforms is this reader
   interested in" is two answers to one question, and they would have disagreed the first time
   somebody set the filter in one place and read it in the other.

   THE CHIPS THEMSELVES HAVE GONE THE SAME WAY. `components/PlatformPicker.astro` is the control on
   all three surfaces now, and it owns the pressed state, the keyboard, and the rule that the last
   platform does not turn off. What is left in this file is the only part that was ever the
   SIDEBAR's: hiding rows, folding an emptied group, the marks on each row, the visibility of the
   `Show all` reset, and the mirror into the URL. */

export function mountPlatformFilter(): void {
  const found = document.querySelector<HTMLElement>('[data-platform-filter]');
  if (!found) return;
  /* Captured after the guard: TypeScript loses the narrowing across the closures below, and a
     non-null assertion at each use would be four places to get wrong instead of one. */
  const root: HTMLElement = found;

  const mapEl = root.querySelector<HTMLScriptElement>('[data-platform-map]');
  const data: { pages?: Record<string, string>; marks?: Record<string, Mark> } = mapEl
    ? JSON.parse(mapEl.textContent ?? '{}')
    : {};
  const map = data.pages ?? {};
  const marks = data.marks ?? {};

  /* The ONE-CLICK WAY BACK, and the whole of what the amber notice left behind. It is shown only
     while something is actually hidden, because a reset for a filter that is not narrowed is a
     control that cannot act. */
  const reset = root.querySelector<HTMLElement>('[data-platform-show-all]');

  let on = currentPlatforms();

  /* The sidebar's own markup is Starlight's, so the rows are found by matching each link's path
     against the map the build emitted. `closest('li')` is what actually hides: hiding the anchor
     alone would leave its bullet and its share of the gap behind. */
  function sidebarRows(): { row: HTMLElement; platform: string }[] {
    const out: { row: HTMLElement; platform: string }[] = [];
    for (const a of document.querySelectorAll<HTMLAnchorElement>('#starlight__sidebar a[href]')) {
      const path = new URL(a.href, window.location.origin).pathname;
      const id = map[path];
      if (!id) continue;
      /* Put the platform's own mark on the row, once. Three rows under one another all wearing the
         same neutral dot still made the reader read three titles to tell them apart; the logo
         answers that before the title does. Done in the same pass that finds the rows, so the mark
         and the filtering can never disagree about which rows are platform rows. */
      a.setAttribute('data-platform-row', id);
      /* Suffixed per row for the same reason the server component does it: a gradient id is
         document-global and these rows add several more copies to a page that already has some. */
      const raw = marks[id];
      const mark = raw ? uniquifyMark(raw, `row${rowSeq++}`) : undefined;
      if (!a.querySelector('.bo-row-mark') && mark) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', `bo-mark bo-mark-${id} bo-row-mark`);
        svg.setAttribute('viewBox', mark.viewBox);
        svg.setAttribute('width', '13');
        svg.setAttribute('height', '13');
        svg.setAttribute('fill', 'currentColor');
        /* `aria-hidden`: the platform is already in the link's own text, and a second announcement
           makes every one of these rows read its name twice. */
        svg.setAttribute('aria-hidden', 'true');
        if (mark.defs) {
          const defs = document.createElementNS(NS, 'defs');
          defs.innerHTML = mark.defs;
          svg.append(defs);
        }
        for (const spec of mark.paths) {
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', spec.d);
          if (spec.fill) path.setAttribute('fill', spec.fill);
          if (spec.opacity) path.setAttribute('fill-opacity', spec.opacity);
          svg.append(path);
        }
        a.prepend(svg);
      }
      const row = a.closest('li');
      if (row) out.push({ row, platform: id });
    }
    return out;
  }

  function apply(): void {
    for (const { row, platform } of sidebarRows()) {
      row.hidden = !on.has(platform as PlatformId);
    }

    /* A group whose every child is hidden is an empty heading with a caret that opens onto nothing.
       Fold the group away with its contents. */
    let hiddenRows = 0;

    for (const group of document.querySelectorAll<HTMLElement>('#starlight__sidebar details')) {
      const rows = [...group.querySelectorAll('li')];
      const visible = rows.filter((r) => !r.hidden);
      hiddenRows += rows.length - visible.length;
      group.hidden = rows.length > 0 && visible.length === 0;
    }

    /* THE RESET HIDES WHEN NOTHING IS HIDDEN — derived from the effect, not from a parallel count.
       It used to compare the chosen set against `PLATFORM_IDS`, which is the five platform
       IDENTITIES, while this sidebar only ever draws the three that have pages. So with all three
       ticked the picker read `All platforms`, zero rows were hidden, and `Show all` stayed on screen
       offering to undo a filter that was not narrowing anything — measured on
       `/start/getting-started/?platform=airtable,clickup,notion`, 2026-08-21. Counting the rows the
       filter actually hid cannot drift from the catalogue again, because it never reads it. */
    if (reset) reset.hidden = hiddenRows === 0;

    /* In-page tab blocks obey the same filter. A tab for a platform the reader switched off is a
       promise the page cannot keep, and a strip with one tab left is a control that cannot act, so
       it goes entirely and the surviving panel is simply the content. */
    for (const block of document.querySelectorAll<HTMLElement>('[data-platform-tabs]')) {
      const tabs = [...block.querySelectorAll<HTMLButtonElement>('[data-platform-tab]')];
      const panels = [...block.querySelectorAll<HTMLElement>('[data-platform-panel]')];
      const strip = block.querySelector<HTMLElement>('[data-platform-tabs-strip]');

      for (const t of tabs) t.hidden = !on.has(t.dataset.platformTab as PlatformId);
      const live = tabs.filter((t) => !t.hidden);
      if (strip) strip.hidden = live.length < 2;

      /* Keep a selection that still exists; otherwise fall to the first surviving tab. */
      let chosen = live.find((t) => t.getAttribute('aria-selected') === 'true') ?? live[0];
      if (!chosen) continue;
      for (const t of tabs) t.setAttribute('aria-selected', String(t === chosen));
      for (const panel of panels) {
        panel.hidden = panel.dataset.platformPanel !== chosen.dataset.platformTab;
      }
    }

    /* The page you are ON may be one your filter hides. Say so rather than letting it look like a
       page we wrote badly. */
    const self = document.querySelector<HTMLElement>('[data-page-platform]');
    if (self) {
      const id = self.dataset.pagePlatform ?? '';
      const notice = document.querySelector<HTMLElement>('[data-platform-page-notice]');
      if (notice) notice.hidden = on.has(id as PlatformId);
    }
  }

  /**
   * `?platform=` MIRRORS THE CHOICE, so the address bar is always shareable and always says what
   * the reader is looking at. It is written from ONE place — the subscription below — rather than
   * from each thing that can change the filter. It used to be written by this file's own setter,
   * which was correct only for as long as the sidebar's own chips were the only way to change it;
   * the moment the search modal grew the same filter, narrowing there left the URL saying something
   * else. Mirroring on the CHANGE rather than on the CLICK cannot drift that way.
   *
   * It is deliberately not called on first paint. Doing so would rewrite a shared `?platform=` link
   * with the recipient's own stored preference the instant they opened it, which is the precedence
   * `readPlatformPreference` exists to protect.
   */
  function mirrorUrl(): void {
    const url = new URL(window.location.href);
    if (on.size === PLATFORM_IDS.length) url.searchParams.delete('platform');
    else url.searchParams.set('platform', [...on].join(','));
    window.history.replaceState(null, '', url);
  }

  /* Writing is all this does. The write dispatches the change, and the subscription below is what
     moves this page — which is the same path a change made in the search modal or the chat takes,
     so there is exactly one. */
  function set(next: Set<PlatformId>): void {
    writePlatformPreference(next);
  }

  /* EVERY CHANGE ARRIVES HERE, whoever made it — the picker above this tree, the picker in the
     search modal, the picker in the chat, the amber notice's Show all, or the page-level "show it
     anyway". Without this a reader who narrows to Notion in search closes the dialog onto a sidebar
     still showing everything: one filter that visibly disagrees with itself. Nothing is written
     back, because that would re-broadcast what we have just been told. */
  onPlatformsChange((next) => {
    if (samePlatforms(next, on)) return;
    on = next;
    mirrorUrl();
    apply();
  });

  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-platform-show-all]')) {
      set(new Set(PLATFORM_IDS));
    }
  });

  /* THE RESET DISAPPEARS UNDER THE POINTER THAT PRESSED IT, which is correct — nothing is hidden
     any more, so the control has nothing left to do — but the reader has just lost the element
     their focus was on, and focus would fall to `<body>`. Hand it to the trigger, which is the
     thing the reset was acting on and is one Tab from where they were. */
  reset?.addEventListener('click', () => {
    root.querySelector<HTMLButtonElement>('[data-pk-trigger]')?.focus();
  });

  /* Tab clicks are delegated from the document because the blocks live inside prose this component
     does not own, and there may be several on one page. They all move together on purpose: a reader
     who picked Notion at the top of a page has not changed their mind by the middle of it. */
  document.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-platform-tab]');
    if (!tab) return;
    const id = tab.dataset.platformTab;
    if (!id || !isPlatform(id)) return;
    for (const block of document.querySelectorAll<HTMLElement>('[data-platform-tabs]')) {
      for (const t of block.querySelectorAll<HTMLButtonElement>('[data-platform-tab]')) {
        t.setAttribute('aria-selected', String(t.dataset.platformTab === id));
      }
      for (const panel of block.querySelectorAll<HTMLElement>('[data-platform-panel]')) {
        panel.hidden = panel.dataset.platformPanel !== id;
      }
    }
  });

  /* The page-level "show it anyway" is outside this component's markup, so it is wired from here
     rather than from the page: one owner for one piece of state. */
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-platform-page-show]')) return;
    const self = document.querySelector<HTMLElement>('[data-page-platform]');
    const id = self?.dataset.pagePlatform;
    if (!id || !isPlatform(id)) return;
    set(new Set([...on, id]));
  });

  apply();
}
