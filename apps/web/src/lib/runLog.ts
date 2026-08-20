/**
 * runLog — the ONE controller behind an audit log table (2026-08-11).
 *
 * Search + faceted filters + click-sort + pagination + the no-match state, wired once. Two
 * surfaces render a log of runs — `/backups` (every backup run) and `/restore` (the same log
 * filtered to restores) — and they are genuinely different TABLES: a backup row is asked "which
 * trigger, how many bases", a restore row "into what, how much is left to finish by hand". The
 * columns differ, so the markup differs, and it should.
 *
 * What does NOT differ is any of the behaviour. Before this module the Backups list carried ~100
 * lines of wiring inside an `.astro` <script>, and building the restore log meant copying them.
 * That is how this codebase ends up with six ways to do one thing (J05), so the wiring moved out
 * and the two views pass their differences in as config.
 *
 * It also moves the wiring somewhere a type-checker can see it: `astro check` walks `apps/design`
 * only, so a `<script>` block inside an `.astro` file in `apps/web` is checked by NOTHING. A `.ts`
 * module under `tsc --noEmit --strict` is (PARKED: typecheck-blind-to-astro-scripts).
 *
 * The contract each caller supplies:
 *   · `name`        — the pager/facet prefix, also the localStorage key for rows-per-page.
 *   · `rowSelector` — the row class; rows are re-read from the DOM on every render because
 *                     `wireTableSort` REORDERS them and a captured array would page the pre-sort
 *                     order, handing page 1 the wrong rows.
 *   · `multiFacets` / `singleFacet` — facet names as emitted by `FacetFilter`. Multi facets emit
 *                     `hidden` (de-selected values → rows to hide); a single facet emits `value`.
 *   · `matchExtra`  — anything the shared matcher cannot know, e.g. a date range in days.
 *   · `sortValue`   — the value for a column index, read off `data-*` on the ROW, never off cell
 *                     text: "5d ago" and "2m 14s" do not compare.
 */
import { createPager } from '../components/ui/tablePager';
import { wireTableSort } from '../components/schema/tableSort';

export interface RunLogConfig {
  /** The element carrying the list — everything is queried inside it. */
  root: HTMLElement;
  /** Pager + facet prefix (`bl`, `rl`, …). */
  name: string;
  rowSelector: string;
  sizes: number[];
  defaultSize: number;
  /** Facet names whose de-selected values hide rows, keyed to a `data-*` attribute on the row. */
  multiFacets: { facet: string; dataKey: string }[];
  /** The one mutually-exclusive facet, if the surface has one (a date range, in days). */
  singleFacet?: string;
  /** Column index → comparable value, read off the row's data-*. */
  sortValue: (row: HTMLElement, col: number) => string | number;
  /**
   * Run after every filter/sort/page render. A row hidden with `display: none` measures 0 wide, so
   * anything that decides by MEASUREMENT — `clipTips`, which only tooltips a cell that is actually
   * clipped — loses its answer when the pager hides a row and never gets it back, because the
   * feed's own size did not change and no observer fires. Every host that measures has to be told.
   */
  onAfterRender?: () => void;
}

export interface RunLog {
  /** Re-run filtering + paging. Exposed so a caller can react to something of its own. */
  render: () => void;
}

const DAY = 86_400_000;

export function createRunLog(cfg: RunLogConfig): RunLog | null {
  const { root, name, rowSelector } = cfg;
  const body = root.querySelector<HTMLElement>(`[data-${name}-body]`);
  const searchEl = root.querySelector<HTMLInputElement>(`[data-${name}-search]`);
  const noMatch = root.querySelector<HTMLElement>(`[data-${name}-nomatch]`);
  const tableWrap = root.querySelector<HTMLElement>(`[data-${name}-tablewrap]`);
  if (!body || !searchEl || !noMatch || !tableWrap) return null;

  const clearEls = Array.from(root.querySelectorAll<HTMLButtonElement>(`[data-${name}-clear]`));
  const domRows = () => Array.from(body.querySelectorAll<HTMLElement>(rowSelector));

  // Keyboard: Enter/Space opens the row (the inline onclick navigates). Part of the shared
  // row-clickable pattern — a row that is `role="button"` and only reachable by mouse is not one.
  domRows().forEach((r) =>
    r.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        r.click();
      }
    }),
  );

  const pager = createPager({
    root,
    name,
    sizes: cfg.sizes,
    defaultSize: cfg.defaultSize,
    storageKey: `${name}-pagesize`,
    onChange: () => render(),
  });

  const hidden: Record<string, Set<string>> = {};
  for (const m of cfg.multiFacets) hidden[m.facet] = new Set<string>();
  let singleValue = '';

  const anyFilter = () =>
    cfg.multiFacets.some((m) => hidden[m.facet].size > 0) ||
    !!singleValue ||
    !!(searchEl.value || '').trim();

  const matches = (row: HTMLElement) => {
    for (const m of cfg.multiFacets) {
      if (hidden[m.facet].has(row.dataset[m.dataKey] as string)) return false;
    }
    // The single facet is a date range in days everywhere it is used today. Kept concrete rather
    // than pluggable: one caller with one meaning is not a reason for a strategy parameter.
    if (singleValue) {
      const age = (Date.now() - new Date(row.dataset.date as string).getTime()) / DAY;
      if (age > Number(singleValue)) return false;
    }
    const q = (searchEl.value || '').trim().toLowerCase();
    if (q && !(row.dataset.search || '').includes(q)) return false;
    return true;
  };

  const render = () => {
    const current = domRows();
    const matched = current.filter((r) => matches(r));
    current.forEach((r) => (r.style.display = 'none'));
    pager.window(matched).forEach((r) => (r.style.display = ''));

    const empty = matched.length === 0;
    noMatch.hidden = !empty;
    tableWrap.style.display = empty ? 'none' : '';
    clearEls.forEach((el) => (el.hidden = !anyFilter()));
    cfg.onAfterRender?.();
  };

  wireTableSort(
    root,
    () => [
      {
        headers: Array.from(root.querySelectorAll<HTMLElement>('thead [data-sort-col]')),
        container: body,
        items: domRows,
      },
    ],
    (row, col) => cfg.sortValue(row, col),
    // A new order means page 1 is a different set of rows.
    () => {
      pager.reset();
      render();
    },
  );

  searchEl.addEventListener('input', () => {
    pager.reset();
    render();
  });

  document.addEventListener('facetchange', (ev) => {
    const d = (ev as CustomEvent).detail || {};
    if (cfg.singleFacet && d.name === cfg.singleFacet) singleValue = d.value || '';
    else if (d.name in hidden) hidden[d.name] = new Set<string>(d.hidden || []);
    else return;
    pager.reset();
    render();
  });

  clearEls.forEach((el) =>
    el.addEventListener('click', () => {
      searchEl.value = '';
      for (const m of cfg.multiFacets) hidden[m.facet] = new Set<string>();
      singleValue = '';
      document.dispatchEvent(new CustomEvent('facetreset'));
      pager.reset();
      render();
    }),
  );

  render();
  return { render };
}
