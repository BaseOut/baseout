/**
 * tableA11y — the `aria-sort` half of the one table, mounted by `components/ui/Table.astro`.
 *
 * WHY IT IS A MODULE AND NOT A LINE IN `wireTableSort`. `components/schema/tableSort.ts` owns the
 * ORDER; it is called by six surfaces through `lib/runLog.ts` and directly by three Schema tabs, and
 * it writes exactly one thing to the DOM — `data-sort-dir` on the header that is currently active.
 * That attribute drives the CSS caret, which is a SIGHTED affordance and the only one the app has
 * ever had: `aria-sort` and `scope="col"` were measured at **0 occurrences tree-wide** on
 * 2026-08-14, across 24 files that declare a `<th>`. So a screen-reader user could be told a table
 * had been reordered by nothing at all.
 *
 * Mirroring rather than writing it at the source is deliberate. `tableSort.ts` is not owned by this
 * batch, and more importantly the two facts live on different elements: `data-sort-dir` belongs on
 * the clickable thing (now a `<button>`, so the sort is reachable by keyboard), and `aria-sort`
 * belongs on the `<th>` that names the column — ARIA defines it only on a header cell, so a value
 * parked on the button inside would be inert. One observer resolves the `<th>` with `closest()` and
 * keeps the two in step, and any future sorter gets the announcement for free by writing the same
 * attribute the caret already needs.
 *
 * A MutationObserver, not a click listener: sort can also be applied without a click — `reapply()`
 * runs after a filter/page render on every `runLog` surface — and a listener would miss those.
 */

/** ARIA's three legal values for a sortable column. `other` is not used: this app sorts one way. */
type AriaSort = 'ascending' | 'descending' | 'none';

const DIR_TO_ARIA: Record<string, AriaSort> = { asc: 'ascending', desc: 'descending' };

function syncOne(el: HTMLElement): void {
  const th = el.closest('th');
  if (!th) return;
  th.setAttribute('aria-sort', DIR_TO_ARIA[el.dataset.sortDir ?? ''] ?? 'none');
}

/**
 * Keep every `aria-sort` under `root` equal to the `data-sort-dir` the sorter wrote.
 * Idempotent per root — a page that re-runs its init on `astro:page-load` does not stack observers.
 * Returns a disposer.
 */
export function mountTableA11y(root: HTMLElement): () => void {
  if (root.dataset.tableA11y) return () => {};
  root.dataset.tableA11y = '1';

  const all = () => Array.from(root.querySelectorAll<HTMLElement>('[data-sort-col]'));
  all().forEach(syncOne);

  const obs = new MutationObserver((records) => {
    for (const r of records) {
      const t = r.target as HTMLElement;
      if (t instanceof HTMLElement && t.hasAttribute('data-sort-col')) syncOne(t);
    }
  });
  obs.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-sort-dir'] });

  return () => {
    obs.disconnect();
    delete root.dataset.tableA11y;
  };
}

/** Mount on every vessel-rendered table currently in the document. Safe to call repeatedly. */
export function mountAllTableA11y(): void {
  document
    .querySelectorAll<HTMLElement>('[data-table]')
    .forEach((el) => mountTableA11y(el));
}
