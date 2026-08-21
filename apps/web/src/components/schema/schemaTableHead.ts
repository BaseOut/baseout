/**
 * schemaTableHead — the Schema tabs' column definitions, plus the ONE runtime emitter of the
 * vessel's header.
 *
 * WHY THIS FILE EXISTS. `components/ui/Table.astro` is the one table vessel and it renders the
 * `<thead>` itself, which removes the header from every caller that is an Astro component. Two
 * Schema tabs are not only Astro components: `schemaAutomations.ts` and `schemaRelationships.ts`
 * build a whole new group — wrapper, table, header, empty body — as a runtime `innerHTML` string
 * when the user registers an automation or declares a synced table for a Base that has no group
 * yet. An `.astro` component has no reach there, so before this file the header existed TWICE per
 * tab, hand-written, and had already drifted: the SSR half wrote `aria-label="Actions"` on the
 * trailing affordance column and the string half wrote `<th class="au-th-act"></th>` — an unnamed
 * column for anyone using a screen reader, on exactly the rows a user had just created. It is the
 * same failure mode `relStatusBadge.ts` was extracted for one batch earlier (`badge-sm` and a
 * `size-3` glyph on the injected pill that the server-rendered pill did not have).
 *
 * So the columns are declared ONCE here. The `.astro` passes the array to `<Table columns={…}>`;
 * the controller passes the SAME array to `tableHeadHtml()`, which emits the markup `Table.astro`
 * emits. Neither half can be edited without the other following, because there is only one array
 * and one emitter.
 *
 * THIS EMITTER IS A MIRROR, NOT A SECOND OPINION. Every structural fact below —
 * `scope="col"`, `aria-sort="none"`, the `<button class="tbl-sortbtn" data-sort-col=INDEX>`, the
 * `.tbl-colhead` band — is copied from `components/ui/Table.astro` and must stay copied. If the
 * vessel grows a header fact, it belongs here the same day; `verifyHeadParity` (see the report
 * check in the batch notes) reads both halves out of the live DOM and compares them.
 */
import type { TableColumn } from '../../lib/table/contract';

const escAttr = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The vessel's `<thead>`, as a string.
 *
 * `index` is the column's position in the array — the same number `Table.astro` computes — so a
 * `data-sort-col` can no more be hand-numbered here than it can at an `.astro` call site.
 */
export function tableHeadHtml(columns: TableColumn[]): string {
  const cells = columns
    .map((col, i) => {
      const classes = [col.align === 'end' ? 'text-right' : '', col.class ?? ''].filter(Boolean).join(' ');
      const classAttr = classes ? ` class="${escAttr(classes)}"` : '';
      const sortAttr = col.sort ? ' aria-sort="none"' : '';
      const inner = col.sort
        ? `<button type="button" class="tbl-sortbtn" data-sort-col="${i}">${escAttr(col.label)}</button>`
        : col.label
          ? escAttr(col.label)
          : `<span class="sr-only">${escAttr(col.srLabel ?? '')}</span>`;
      return `<th scope="col"${classAttr}${sortAttr}>${inner}</th>`;
    })
    .join('');
  return `<thead class="tbl-colhead"><tr>${cells}</tr></thead>`;
}

/**
 * Automations — one table per Base group. The trailing column holds the row's edit/delete controls
 * and the chevron; it has no visible label, so it carries `srLabel` (the contract refuses a column
 * with neither).
 */
export const AU_COLUMNS: TableColumn[] = [
  { label: 'Name', sort: true, class: 'au-th-name' },
  { label: 'Status', sort: true, class: 'au-th-status' },
  { label: 'Trigger', sort: true, class: 'au-th-trigger' },
  { label: 'Tagged', sort: true, class: 'au-th-tags' },
  { label: '', srLabel: 'Actions', class: 'au-th-act' },
];

/** Relationships — the flat (all-Bases) table. Not sortable: the tree view owns the sort. */
export const RL_FLAT_COLUMNS: TableColumn[] = [
  { label: 'Relationship' },
  { label: 'Type' },
  { label: 'Base' },
  { label: 'Cardinality', class: 'rl-ft-r' },
  { label: 'Actions', class: 'rl-ft-act' },
];

/**
 * Browse — the Flat mode table. The sort here is Browse's own (it knows the health ranking), not
 * `wireTableSort`, but the header contract is the shared one: the index below is what the sort
 * handler reads, so `BR_FLAT_SORT_KEYS[i]` is the key for column `i` and the two cannot drift.
 */
export const BR_FLAT_COLUMNS: TableColumn[] = [
  { label: 'Name', sort: true, class: 'br-th' },
  { label: 'Type', sort: true, class: 'br-th' },
  { label: 'Parent', sort: true, class: 'br-th' },
  { label: 'Health', sort: true, class: 'br-th' },
  { label: '', srLabel: 'Open' },
];

/** Column index → the `data-*` key on a `.br-trow` that column sorts by. */
export const BR_FLAT_SORT_KEYS = ['name', 'type', 'parent', 'health'] as const;
