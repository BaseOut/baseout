/**
 * The ⌘K search modal.
 *
 * Replaces Starlight's Pagefind UI, which is a closed component: it can be restyled but it cannot
 * be given a resting state, and the resting state is the whole point of Stripe's modal — before you
 * type it already offers the page you were last reading and the questions people actually arrive
 * with. An empty box that waits is a worse answer than a box that guesses.
 *
 * IT IS A `<dialog>`, so the platform supplies the modal semantics we would otherwise re-implement
 * badly: focus containment, inertness of the page behind, Escape, and the backdrop. Our own Escape
 * layering does not need to know about it either — an open dialog takes the key first.
 *
 * SEARCH IS THE SAME CODE THE HERO USES (`lib/pagefind.ts` + `lib/rows.ts`), including the two-pass
 * render: the Ask row lands with the keystroke, documents follow when the index answers. The index
 * is a wasm module fetched on first use, and a first query that sits on a blank panel reads as a
 * search that does not work.
 *
 * IT SEARCHES THE DOCUMENTATION ONLY, which is narrower than the index it reads — see `isDocsUrl`
 * below for why that filter cannot be moved into the build.
 */
import { indexAvailable, searchDocs } from './pagefind';
import {
  PLATFORM_IDS,
  FILTER_EVENT,
  readPlatformPreference,
  writePlatformPreference,
  type PlatformId,
} from './platforms';
import { readRecent, recordVisit } from './recent';
import { POPULAR_QUESTIONS } from './questions';
import { askRow, docRow, groupLabel, linkRow, OPEN_CHAT_EVENT, ICON_ASK, ICON_CLOCK, ICON_DOC } from './rows';

const MAX_RESULTS = 6;
const DEBOUNCE_MS = 120;

/* Asked of the index, before the docs filter. Pagefind ranks and truncates first, so asking for
   exactly MAX_RESULTS and then dropping the request pages out of them is how a query about
   "restore" comes back with two documents and four missing ones. Ask for more than we will show. */
const FETCH_RESULTS = MAX_RESULTS * 3;

/**
 * THE INDEX IS DELIBERATELY BROADER THAN THIS SEARCH, and the narrowing has to live here.
 *
 * Pagefind indexes the whole site — every `/roadmap/<slug>` request page and the contact form along
 * with the documentation. That breadth is load bearing somewhere else: `lib/submit.ts` does
 * duplicate detection on the contact form by querying this same index and keeping ONLY the hits
 * under `/roadmap/`. So narrowing the INDEX instead — a `data-pagefind-ignore` on the request pages
 * is the obvious way, and it looks harmless — makes duplicate detection silently return nothing,
 * forever, with nothing to see in this file. The index therefore stays complete, and the one
 * surface that promises documentation ("Search the documentation", on the button and in the field)
 * filters what it renders. Do not move this into the build.
 *
 * `/submit` and `/tickets` are redirects to `/contact`, so they are the same page under two more
 * names and are excluded with it.
 */
const NOT_DOCS = ['roadmap', 'contact', 'submit', 'tickets'];

const isDocsUrl = (url: string): boolean => {
  /* Off-site is not documentation, and `//host` is off-site while looking site-relative. */
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  /* The FIRST SEGMENT, not a prefix: `startsWith('/roadmap')` would also throw away a future
     `/roadmap-glossary/` page, which is documentation by every measure that matters. */
  const first = url.slice(1).split(/[/?#]/, 1)[0] ?? '';
  return !NOT_DOCS.includes(first);
};

export function wireSearchModal(): void {
  /* Record the visit on every page, whether or not the modal is ever opened — the list is only
     useful because it was filled while the reader was doing something else. */
  const h1 = document.querySelector('h1');
  recordVisit((h1?.textContent ?? document.title).trim(), location.pathname);

  const dialog = document.querySelector<HTMLDialogElement>('[data-search-modal]');
  if (!dialog) return;

  const input = dialog.querySelector<HTMLInputElement>('[data-search-input]');
  const list = dialog.querySelector<HTMLElement>('[data-search-list]');
  if (!input || !list) return;

  let rows: HTMLAnchorElement[] = [];
  let active = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  /* ── The platform filter, shared with the sidebar ──────────────────────────────────────────
     The same stored preference, read through the same function, so the two chip rows cannot drift
     apart. Missing means everything, which is what a reader who has never chosen expects. */
  const chips = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-search-platform]'));
  let platforms = readPlatformPreference() ?? new Set<PlatformId>(PLATFORM_IDS);

  const paintChips = () => {
    for (const chip of chips) {
      const id = chip.dataset.searchPlatform;
      chip.setAttribute('aria-pressed', String(!!id && platforms.has(id as PlatformId)));
    }
  };

  /** Everything selected is not a filter, so it is sent as `undefined` — see `searchDocs`. */
  const activeFilter = (): string[] | undefined =>
    platforms.size === PLATFORM_IDS.length ? undefined : [...platforms];

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const id = chip.dataset.searchPlatform as PlatformId | undefined;
      if (!id) return;
      const next = new Set(platforms);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      /* THE LAST ONE CANNOT BE TURNED OFF. Zero platforms is a search that can only ever return
         platform-neutral pages, which is not a state anybody means to ask for — the same rule the
         sidebar chips enforce. */
      if (!next.size) return;
      platforms = next;
      paintChips();
      writePlatformPreference(platforms);
      const q = input.value.trim();
      if (q) void run(q);
    });
  }

  /* The sidebar sets the same value; catch up without re-broadcasting it. */
  document.addEventListener(FILTER_EVENT, (e) => {
    const ids = (e as CustomEvent<string[]>).detail;
    if (!Array.isArray(ids) || !ids.length) return;
    platforms = new Set(ids.filter((v): v is PlatformId => (PLATFORM_IDS as string[]).includes(v)));
    paintChips();
  });

  paintChips();

  const collect = () => {
    rows = Array.from(list.querySelectorAll<HTMLAnchorElement>('.sh-row'));
    if (active < 0 || active >= rows.length) active = 0;
    rows.forEach((r, n) => r.setAttribute('aria-selected', String(n === active)));
  };

  const select = (i: number) => {
    if (!rows.length) return;
    active = (i + rows.length) % rows.length;
    rows.forEach((r, n) => r.setAttribute('aria-selected', String(n === active)));
    rows[active]?.scrollIntoView({ block: 'nearest' });
  };

  /** The resting state: what we can offer before a single character is typed. */
  const renderIdle = () => {
    /* `recordVisit` runs on EVERY page, the board and the contact form included, so the recents
       need the same filter the results do — otherwise a modal that says "Search the documentation"
       opens by offering the request you read yesterday. `POPULAR_QUESTIONS` is a curated list in
       `lib/questions.ts` and points only at docs today; it goes through the same predicate so it
       cannot quietly stop doing so, and each group only prints its heading if it has rows left. */
    const recent = readRecent().filter((r) => isDocsUrl(r.url));
    const suggested = POPULAR_QUESTIONS.filter((q) => isDocsUrl(q.href));
    const parts: string[] = [];

    if (recent.length) {
      parts.push(groupLabel('Recently viewed'));
      parts.push(...recent.map((r) => linkRow(r.title, r.url, ICON_CLOCK)));
    }

    if (suggested.length) {
      parts.push(groupLabel('Suggested'));
      parts.push(...suggested.map((q) => linkRow(q.label, q.href, ICON_DOC)));
    }

    parts.push(groupLabel('Or ask'));
    parts.push(linkRow('Ask the support assistant', '#', ICON_ASK, 'Answers grounded in these docs'));

    list.innerHTML = parts.join('');
    collect();
  };

  const renderPending = (q: string) => {
    list.innerHTML = askRow(q) + groupLabel('Documentation') + '<p class="sh-note">Searching…</p>';
    collect();
  };

  /** `hits` arrives ALREADY through `isDocsUrl` — this renders what it is given, `run` decides. */
  const renderResults = (
    q: string,
    hits: Awaited<ReturnType<typeof searchDocs>>,
    indexed: boolean,
    hiddenByFilter: number,
  ) => {
    const docs = hits.map(docRow).join('');
    /* AN EMPTY RESULT MUST NAME ITS OWN CAUSE. "No page matches that" blames the query, and when a
       platform filter is on — possibly set on another surface, or last week — that sentence is
       wrong and sends the reader to ask a question the docs already answer. The count comes from a
       second, unfiltered query run only in this case, so the claim is measured rather than assumed:
       we say the filter hid something only when it actually did. */
    const note = docs
      ? ''
      : !indexed
        ? '<p class="sh-note">Doc search runs on the built site.</p>'
        : hiddenByFilter > 0
          ? `<p class="sh-note">No match in the platforms you picked. ${hiddenByFilter} page${
              hiddenByFilter === 1 ? '' : 's'
            } match${hiddenByFilter === 1 ? 'es' : ''} in the others — ` +
            '<button type="button" class="sh-note-act" data-search-widen>search all platforms</button>.</p>'
          : '<p class="sh-note">No page matches that — ask instead.</p>';
    list.innerHTML = askRow(q) + groupLabel('Documentation') + (docs || note);
    collect();
  };

  const run = async (q: string) => {
    const mine = ++seq;
    const filter = activeFilter();
    const hits = await searchDocs(q, FETCH_RESULTS, filter);
    /* WHETHER THE INDEX ANSWERED is judged on the RAW hits, before the docs filter. A query that
       matched only request pages is a search that worked and found no documentation; telling that
       reader "Doc search runs on the built site" would blame the machinery for a real answer. */
    const indexed = hits.length > 0 || (await indexAvailable());
    const docs = hits.filter((h) => isDocsUrl(h.url));
    /* Only when the filtered search came back empty, and only to count. */
    const hiddenByFilter =
      filter && !docs.length
        ? (await searchDocs(q, FETCH_RESULTS)).filter((h) => isDocsUrl(h.url)).length
        : 0;
    if (mine !== seq) return; // A slower earlier keystroke must not overwrite a newer one.
    renderResults(q, docs.slice(0, MAX_RESULTS), indexed, hiddenByFilter);
  };

  list.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-search-widen]')) return;
    platforms = new Set<PlatformId>(PLATFORM_IDS);
    paintChips();
    writePlatformPreference(platforms);
    const q = input.value.trim();
    if (q) void run(q);
  });

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (!q) {
      renderIdle();
      return;
    }
    renderPending(q);
    timer = setTimeout(() => void run(q), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      select(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      select(active - 1);
    } else if (e.key === 'Enter') {
      const row = rows[active];
      const q = input.value.trim();
      if (!row && !q) return;
      e.preventDefault();
      if (!row) return void openChat(q);
      row.click(); // One path for pointer and keyboard — the click handler decides what a row means.
    }
  });

  /** Asking is a drawer, not a destination — see `lib/rows.ts`. */
  const openChat = (q: string) => {
    dialog.close();
    document.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { q } }));
  };

  /* One handler for every row, delegated, so it survives the list being rebuilt on each keystroke. */
  list.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-open-chat]');
    if (!row) return;
    e.preventDefault();
    openChat(row.dataset.q || input.value.trim());
  });

  const open = () => {
    input.value = '';
    renderIdle();
    dialog.showModal();
    input.focus();
  };

  for (const el of document.querySelectorAll('[data-search-open]')) {
    el.addEventListener('click', () => open());
  }

  /* ⌘K / Ctrl-K anywhere, and `/` when the reader is not already typing — the two shortcuts docs
     sites have taught people to expect. */
  document.addEventListener('keydown', (e) => {
    const typing =
      e.target instanceof HTMLElement &&
      (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    } else if (e.key === '/' && !typing && !dialog.open) {
      e.preventDefault();
      open();
    }
  });

  /* A click on the backdrop lands on the dialog element itself, never on its contents. */
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}
