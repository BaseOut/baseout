import { fmtCount } from '../../lib/fmtCount'

/**
 * The same pager as an HTML STRING, for a host that re-renders its markup instead of keeping a
 * persistent node — the Changelog drill, where every open panel owns its own page position and the
 * body is rebuilt from innerHTML on each render. Such a host keeps its own page state and calls
 * this for the chrome; the markup, classes and metrics stay identical to <TablePager />, which is
 * the part that was actually drifting.
 *
 * Emits the shared `data-pager-*` hooks, so a host can delegate on the same selectors.
 */
export function pagerHtml(state: {
  /** Offered page sizes. */
  sizes: number[];
  /** Currently selected page size. */
  pageSize: number;
  /** 1-based current page. */
  page: number;
  /** Total pages (≥ 1). */
  pages: number;
  /** Total items across all pages. */
  total: number;
  /** Extra classes on the wrapper — e.g. `tpg-tight` under a panel header. */
  className?: string;
}): string {
  const { sizes, pageSize, page, pages, total, className = '' } = state;
  const start = (page - 1) * pageSize;
  const range = total === 0 ? '0' : `${fmtCount(start + 1)}–${fmtCount(Math.min(start + pageSize, total))}`;
  return `
    <div class="tpg${className ? ` ${className}` : ''}">
      <label class="inline-flex items-center gap-2 text-xs font-medium text-base-content/65">Rows
        <select class="select select-sm" data-pager-size aria-label="Rows per page">
          ${sizes.map((n) => `<option value="${n}"${n === pageSize ? ' selected' : ''}>${n}</option>`).join('')}
        </select>
      </label>
      <div class="ml-auto text-sm text-base-content/65"><span class="mono-data" data-pager-range>${range}</span> of <span class="mono-data" data-pager-total>${fmtCount(total)}</span></div>
      <div class="tpg-btns">
        <button type="button" class="btn btn-sm btn-square btn-ghost" data-pager-prev aria-label="Previous page"${page <= 1 ? ' disabled' : ''}><span class="iconify lucide--chevron-left size-4" aria-hidden="true"></span></button>
        <button type="button" class="btn btn-sm btn-square btn-ghost" data-pager-next aria-label="Next page"${page >= pages ? ' disabled' : ''}><span class="iconify lucide--chevron-right size-4" aria-hidden="true"></span></button>
      </div>
    </div>`;
}

export interface PagerOptions {
  /** Element containing the <TablePager /> markup. */
  root: HTMLElement;
  /** Must match the component's `name` prop. */
  name: string;
  /** Offered page sizes — a stored preference outside this list is ignored. */
  sizes: number[];
  /** Used when nothing is stored (or storage is blocked/corrupt). */
  defaultSize: number;
  /** localStorage key for the rows-per-page preference; own it per surface. */
  storageKey: string;
  /** Re-run the surface's own apply()/render() after page or page-size changes. */
  onChange: () => void;
}

export interface Pager {
  /** Current 1-based page (clamped by the last `window()` call). */
  readonly page: number;
  /** Current rows-per-page. */
  readonly pageSize: number;
  /** Back to page 1 — call on every search / filter / sort / mode change. */
  reset(): void;
  /**
   * Clamp, slice and repaint the pager chrome. Returns the visible slice of `items`;
   * the caller decides how to show/hide rows (they are `hidden` attributes, not re-renders).
   */
  window<T>(items: T[]): T[];
}

/**
 * createPager — the behaviour half of <TablePager /> (catalog: pattern-table-toolbar).
 *
 * The contract, in one place so no surface can drift from it again:
 *  · the window is applied to the ALREADY filtered + sorted list, never to the raw rows;
 *  · `page` is ephemeral — a reload starts at page 1;
 *  · `pageSize` is a USER PREFERENCE under its own storage key — never part of a preset, a view
 *    config or a dirty diff, so changing rows-per-page can never mark a view dirty;
 *  · the page clamps when a shrinking set (a filter change) would otherwise leave it blank;
 *  · any change to search / filter / sort / mode resets to page 1 — call `reset()`.
 */
export function createPager(opts: PagerOptions): Pager {
  const { root, name, sizes, defaultSize, storageKey, onChange } = opts;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(`[data-pager="${name}"] ${sel}`);

  const wrap = root.querySelector<HTMLElement>(`[data-pager="${name}"]`);
  const sizeEl = q<HTMLSelectElement>('[data-pager-size]');
  const rangeEl = q('[data-pager-range]');
  const totalEl = q('[data-pager-total]');
  const prevBtn = q<HTMLButtonElement>('[data-pager-prev]');
  const nextBtn = q<HTMLButtonElement>('[data-pager-next]');

  let page = 1;
  let pageSize = defaultSize;
  try {
    const n = Number(localStorage.getItem(storageKey));
    if (sizes.includes(n)) pageSize = n;
  } catch { /* blocked/corrupt storage — the default is a fine answer */ }
  if (sizeEl) sizeEl.value = String(pageSize);

  sizeEl?.addEventListener('change', () => {
    const n = Number(sizeEl.value);
    pageSize = sizes.includes(n) ? n : defaultSize;
    try { localStorage.setItem(storageKey, String(pageSize)); } catch { /* best-effort — a preference, not correctness */ }
    page = 1;
    onChange();
  });
  prevBtn?.addEventListener('click', () => { if (page > 1) { page -= 1; onChange(); } });
  nextBtn?.addEventListener('click', () => { page += 1; onChange(); });

  return {
    get page() { return page; },
    get pageSize() { return pageSize; },
    reset() { page = 1; },
    window<T>(items: T[]): T[] {
      const total = items.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      if (page > pages) page = pages;
      if (page < 1) page = 1;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      if (rangeEl) rangeEl.textContent = total === 0 ? '0' : `${start + 1}–${Math.min(end, total)}`;
      if (totalEl) totalEl.textContent = fmtCount(total);
      if (prevBtn) prevBtn.disabled = page <= 1;
      if (nextBtn) nextBtn.disabled = page >= pages;
      // A pager over an empty result set is noise — the surface's own "no matches" state speaks.
      if (wrap) wrap.hidden = total === 0;
      return items.slice(start, end);
    },
  };
}
