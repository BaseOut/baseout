/**
 * The table vessel's contract — the parts a `.astro` frontmatter must not carry.
 *
 * `feedback-astro-frontmatter-thin`: union-heavy types and branching logic in an `.astro` head break
 * esbuild in this repo. The column model, the pager threshold and the three refusals below are
 * therefore a `.ts` sibling that `Table.astro` imports and `tsc --strict` actually walks — the same
 * split `infra-typecheck-blind-to-astro-scripts` records for `<script>` blocks.
 */

/** One column. The caller describes the column; it never writes the `<th>`. */
export interface TableColumn {
  /** The column label. Empty string for an affordance column (the row chevron) — pair with `srLabel`. */
  label: string;
  /**
   * Sortable. The vessel emits a real `<button>` carrying `data-sort-col=<this column's index>`,
   * so the index can never drift from the `sortValue` switch that reads it, and the sort can never
   * be mouse-only.
   */
  sort?: boolean;
  /** `end` right-aligns the column — the numeric default. */
  align?: 'end';
  /** Classes for BOTH the `<th>` and nothing else; the caller puts the matching class on its `<td>`. */
  class?: string;
  /** Accessible name for a column whose `label` is empty. Required when `label` is empty. */
  srLabel?: string;
  /**
   * This column renders the vessel's `col-extra` slot inside its `<th>`, AFTER the label — for the
   * one case a string cannot express: a header that carries an affordance rather than only a name.
   *
   * It exists because `SchemaRelationships.astro:304` puts the whole status LEGEND — a tooltip card
   * with a three-item list — inside its Status header, which Oleh placed there deliberately in July
   * and kept when the toolbar alternative was rejected. Without this, that table cannot migrate and
   * has to keep a hand-written header, which is the exact drift the vessel exists to remove.
   *
   * WHY A SLOT AND NOT A PROP, because the first version of this field was a prop and was DEAD.
   * It was declared `labelSlot?: unknown` on 2026-08-14, documented at length, and rendered by
   * nothing — `Table.astro` never read it, so a caller passing markup got silence. It could not
   * have worked: the `columns` array is built in `.astro` FRONTMATTER, and `lib/ui.ts` records why
   * that is fatal — "a literal markup tag inside `.astro` frontmatter is read by Astro's scanner as
   * JSX and breaks the build". A prop carrying markup was unbuildable by construction. A named slot
   * lives in the template, where markup belongs.
   *
   * So this is a BOOLEAN, not content: it marks which `<th>` receives the slot. The caller writes
   * the markup as `<Fragment slot="col-extra">…</Fragment>`.
   *
   * At most ONE column may set it — a single named slot can only be rendered once, and rendering it
   * twice would silently drop one. `assertTableContract` refuses more than one.
   *
   * Deliberately NOT a replacement for `label`: the column still has a name, still sorts, still
   * emits `scope="col"`. This adds to the head; it cannot empty it.
   */
  labelSlot?: boolean;
}

/**
 * THE PAGER THRESHOLD, STATED IN ROWS.
 *
 * `pattern-table-toolbar` said "any set that can grow" and named no number, and six surfaces
 * answered "no" to it. A number is answerable. 25 is not arbitrary: it is the smallest default page
 * size already in the app (`TablePager`'s Schema tables and the Changelog drill), so a table that
 * renders more rows than the app's own smallest page is by definition a table the app already
 * considers pageable.
 */
export const PAGER_ROWS = 25;

/**
 * How the row count behaves over the life of the product. The caller MUST answer; there is no
 * default, because the default is what six surfaces took.
 *
 * · `paged` — the set grows with use (a run log, a registry, a record grid). Requires a pager.
 * · `fixed` — the set is bounded by the data model (the seven health metrics, a run's bases).
 *   Checked against reality below, so "fixed" cannot be used to opt out of a pager.
 * · `unpaged` — the set can exceed the floor AND this table correctly has no pager. **Requires a
 *   `growthReason`**, exactly as `narrow` requires a `narrowReason`, because this is the value that
 *   could otherwise become the escape hatch `growth` exists to close.
 *
 *   Two real situations demanded it on the same day, from opposite ends, and neither could answer
 *   honestly with two values:
 *     · `ReportBodyKpi` is also the PDF/HTML a subscriber receives by email. A page-size select
 *       cannot exist in a document, so `paged` is impossible — and `fixed` is a lie for the two
 *       tables whose sets grow with the reporting WINDOW rather than with the data model.
 *     · `SchemaAutomations` is ONE paged set rendered as N tables, one per Base, with a single
 *       `TablePager` outside all of them. `paged` would put a pager under every group.
 *
 *   So the third value does not mean "no pager needed". It means **"no pager HERE, and here is
 *   why"** — a claim the next reader can check, which is the whole difference between this and the
 *   silence six surfaces chose.
 */
export type TableGrowth = 'fixed' | 'paged' | 'unpaged';

/**
 * The narrow strategy. `specs/16-responsive.md` §5, and Oleh has rejected the fold twice — so `pan`
 * is the default and anything else has to say why, in writing, at the call site.
 */
export type TableNarrow = 'pan' | 'fold' | 'none';

export interface TableContract {
  columns: TableColumn[];
  rowCount: number;
  growth: TableGrowth;
  narrow: TableNarrow;
  narrowReason?: string;
  /** Required when `growth` is `unpaged` — why this table correctly has no pager of its own. */
  growthReason?: string;
  hasPager: boolean;
}

/**
 * The three refusals. They throw during render, which in this app is an SSR 500 with a message —
 * loud, immediate, and impossible to ship past, unlike a lint rule a regex cannot express.
 */
export function assertTableContract(c: TableContract, where: string): void {
  if (c.columns.length === 0) {
    throw new Error(`Table (${where}): \`columns\` is empty. The vessel renders the header; a caller with no columns has no table.`);
  }
  for (let i = 0; i < c.columns.length; i++) {
    const col = c.columns[i];
    if (!col.label && !col.srLabel) {
      throw new Error(`Table (${where}): column ${i} has no \`label\` and no \`srLabel\`. An unlabelled column is a column a screen reader cannot name.`);
    }
  }
  if (c.growth === 'paged' && !c.hasPager) {
    throw new Error(`Table (${where}): growth is "paged" but no \`pager\` was passed. A set that can grow gets a TablePager (catalog: pattern-table-toolbar).`);
  }
  /**
   * THIS ONE IS DIFFERENT FROM THE OTHER TWO, AND THE DIFFERENCE IS WHY IT MUST NOT THROW IN
   * PRODUCTION.
   *
   * The `paged`-without-a-pager and `narrow`-without-a-reason checks are STRUCTURAL: they are
   * decided by how the call site is written, so they fire the first time a developer renders the
   * page and can never surprise a user. This one is decided by the DATA. `BackupRunDetailView`
   * renders one row per base in a run and `BackupRunBaseView` one row per table in a base — both
   * declare `fixed`, both are honest about being bounded by the data model, and both are green
   * here only because the fixtures hold 6 and 4 rows. **An Airtable base with 26 tables would have
   * been an SSR 500 in front of a real customer** — a design-system assertion taking the page down
   * to report a design-system opinion.
   *
   * So: loud where it can be acted on, degraded where it cannot. In dev it throws, exactly as
   * before. In production it reports and renders the table anyway — a long table is a worse table,
   * not a broken page.
   */
  if (c.growth === 'fixed' && c.rowCount > PAGER_ROWS && !import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `Table (${where}): growth is "fixed" but ${c.rowCount} rows rendered, over the ${PAGER_ROWS}-row floor. ` +
        'Rendering anyway. This surface needs a pager — see lib/table/contract.ts.',
    );
  } else if (c.growth === 'fixed' && c.rowCount > PAGER_ROWS) {
    throw new Error(`Table (${where}): growth is "fixed" but the table renders ${c.rowCount} rows, over the ${PAGER_ROWS}-row threshold. Declare growth="paged" and pass a \`pager\`.`);
  }
  if (c.growth === 'unpaged' && !c.growthReason) {
    throw new Error(
      `Table (${where}): growth is "unpaged" but no \`growthReason\` was written. This is the one ` +
        'growth value that can be wrong without anything breaking, so it costs a sentence.',
    );
  }
  if (c.narrow !== 'pan' && !c.narrowReason) {
    throw new Error(`Table (${where}): narrow="${c.narrow}" needs a \`narrowReason\`. Pan is the default (specs/16-responsive.md §5); a fold has been rejected twice and must argue for itself at the call site.`);
  }
}
