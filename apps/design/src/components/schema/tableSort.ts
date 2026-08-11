/**
 * Shared click-to-sort for the Schema table views (Automations · Interfaces · Relationships).
 * Dan 2026-07-03: "add sorting to the table views (click on header to sort up/down)".
 *
 * Each tab groups rows by Base, so the header repeats per group. Clicking any group's header sorts
 * EVERY group by that column (one consistent order), toggling asc → desc → asc. Sortable headers
 * carry `data-sort-col="<cell index>"`; the active header shows a ▲/▼ via `data-sort-dir` (CSS).
 * Value extraction is caller-provided (each tab reads its own cells / semantic ranks).
 */
export interface SortGroup {
  /** The sortable header cells (each with data-sort-col) for this group. */
  headers: HTMLElement[];
  /** The element rows are appended into (a <tbody>, or a container of nodes). */
  container: HTMLElement;
  /** The current sortable items in this group (rows / nodes), in DOM order. */
  items: () => HTMLElement[];
}

export function wireTableSort(
  root: HTMLElement,
  getGroups: () => SortGroup[],
  getValue: (item: HTMLElement, col: number) => string | number,
  /** Runs after each re-sort reorders the DOM — lets the caller re-page / re-filter
   *  (e.g. reset the pager and re-apply its window) against the new order. */
  afterSort?: () => void,
) {
  let col = -1;
  let dir: 1 | -1 = 1;

  const apply = () => {
    for (const g of getGroups()) {
      for (const th of g.headers) {
        const c = Number(th.dataset.sortCol);
        if (c === col) th.dataset.sortDir = dir === 1 ? 'asc' : 'desc';
        else th.removeAttribute('data-sort-dir');
      }
      if (col < 0) continue;
      g.items()
        .slice()
        .sort((a, b) => {
          const va = getValue(a, col);
          const vb = getValue(b, col);
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
          return cmp * dir;
        })
        .forEach((el) => g.container.appendChild(el));
    }
    afterSort?.();
  };

  // Delegate so headers added later (a new Base group created on save) are covered too.
  root.addEventListener('click', (e) => {
    const th = (e.target as HTMLElement).closest<HTMLElement>('[data-sort-col]');
    if (!th || !root.contains(th)) return;
    const i = Number(th.dataset.sortCol);
    if (Number.isNaN(i)) return;
    if (col === i) dir = dir === 1 ? -1 : 1;
    else { col = i; dir = 1; }
    apply();
  });

  return { reapply: apply };
}
