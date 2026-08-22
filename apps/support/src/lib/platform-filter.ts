/**
 * The platform filter's controller.
 *
 * WHAT IT TOUCHES: the chips' pressed state, the visibility of platform-tagged rows in the sidebar,
 * the narrowing notice, and the notice on a page that the reader's own filter is hiding. Nothing
 * else. It never rewrites prose and never navigates.
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
  PLATFORMS,
  FILTER_EVENT,
  readPlatformPreference,
  writePlatformPreference,
  uniquifyMark,
  type Mark,
  type PlatformId,
} from './platforms';

/* Counts rows across the whole page so two calls cannot mint the same suffix. */
let rowSeq = 0;

const isPlatform = (v: string): v is PlatformId => (PLATFORM_IDS as string[]).includes(v);

const name = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

/* `readStored`, `fromUrl` and `write` used to live here. They moved to `lib/platforms.ts` when the
   search modal grew the same chips: two implementations of "which platforms is this reader
   interested in" is two answers to one question, and they would have disagreed the first time
   somebody set the filter in one place and read it in the other. */

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

  const narrow = root.querySelector<HTMLElement>('[data-platform-narrow]');
  const narrowText = root.querySelector<HTMLElement>('[data-platform-narrow-text]');

  let on = readPlatformPreference() ?? new Set<PlatformId>(PLATFORM_IDS);

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
    for (const chip of root.querySelectorAll<HTMLButtonElement>('[data-platform-chip]')) {
      const id = chip.dataset.platformChip ?? '';
      chip.setAttribute('aria-pressed', String(on.has(id as PlatformId)));
    }

    for (const { row, platform } of sidebarRows()) {
      row.hidden = !on.has(platform as PlatformId);
    }

    /* A group whose every child is hidden is an empty heading with a caret that opens onto nothing.
       Fold the group away with its contents. */
    for (const group of document.querySelectorAll<HTMLElement>('#starlight__sidebar details')) {
      const rows = [...group.querySelectorAll('li')];
      const visible = rows.filter((r) => !r.hidden);
      group.hidden = rows.length > 0 && visible.length === 0;
    }

    const hidden = PLATFORM_IDS.filter((id) => !on.has(id));
    if (narrow && narrowText) {
      narrow.hidden = hidden.length === 0;
      if (hidden.length) {
        const names = hidden.map(name);
        const list =
          names.length === 1
            ? names[0]
            : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
        narrowText.textContent = `${list} ${names.length === 1 ? 'is' : 'are'} hidden.`;
      }
    }

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

  function set(next: Set<PlatformId>): void {
    on = next;
    writePlatformPreference(on);
    const url = new URL(window.location.href);
    if (on.size === PLATFORM_IDS.length) url.searchParams.delete('platform');
    else url.searchParams.set('platform', [...on].join(','));
    window.history.replaceState(null, '', url);
    apply();
  }

  /* THE SEARCH MODAL SETS THE SAME PREFERENCE, and this is how the sidebar behind it catches up.
     Without it a reader who narrows to Notion in search closes the dialog onto a sidebar still
     showing everything — one filter that visibly disagrees with itself. `set` is not called back,
     because that would write and re-broadcast what we have just been told. */
  document.addEventListener(FILTER_EVENT, (e) => {
    const ids = (e as CustomEvent<string[]>).detail;
    if (!Array.isArray(ids)) return;
    const next = new Set(ids.filter(isPlatform));
    if (!next.size) return;
    if (next.size === on.size && [...next].every((id) => on.has(id))) return;
    on = next;
    apply();
  });

  root.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-platform-chip]');
    if (chip) {
      const id = chip.dataset.platformChip;
      if (!id || !isPlatform(id)) return;
      const next = new Set(on);
      if (next.has(id)) {
        /* Never leave the reader with an empty documentation site. The last chip does not turn off. */
        if (next.size === 1) return;
        next.delete(id);
      } else {
        next.add(id);
      }
      set(next);
      return;
    }
    if ((e.target as HTMLElement).closest('[data-platform-show-all]')) {
      set(new Set(PLATFORM_IDS));
    }
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
