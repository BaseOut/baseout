# D40 — One column header, one sort affordance, one keyboard

**Rule:** Every column label in the product is `.tbl-colhead` (11px · 700 · .04em · uppercase ·
`/.55`); every sortable column is a real `<button>` inside that cell carrying `aria-sort`, wired by
`tableSort.ts`; and the sort indicator is the shared CSS caret — including on the three "tables" that
are grids of `<div>`/`<span>`, which the mechanism must reach rather than exempt.

## Why this option, and what was rejected

Nine constructions exist for one label band, drifting in five metrics at once — four opacities, two
weights, two sizes, two tracking values, three border-tops (X01-F1). `.tbl-colhead` wins on adoption
(18 of 24 header-declaring files; every rival has 1–2) but **that is not why it is the reference.**
It is the only recipe carrying `global.css:1864` — the `:is(button, a, span) { font: inherit; … }`
re-inheritance whose comment records the measurement that caused it: the UA stylesheet resets a form
control's font, so sortable columns rendered in sentence case beside uppercase static ones.
**A sortable header must contain a `<button>` to be keyboard-operable, and every rival recipe breaks
visually the moment you make one accessible.** That is the tie-breaker: the reference is the only
recipe that survives being made correct.

**Rejected: a `Table.astro` / `TableHead.astro` component.** It is the right answer and it is
**DEFERRED by Oleh's ruling of 2026-08-14** (see D15). X01-F2 proves the causal claim — the lens
with a component (`TablePager`, 1 implementation, 13 mounts) versus the lens with a CSS class
(9 implementations, 23 files), same repo, same authors, same period. That half of X01-F2 is filed
against deferred D15 and **is not scheduled here**. This decision converges the nine onto the class
that already exists, which is the work that must happen either way and is not undone by a later
vessel.

**Rejected: exempting Health, Docs and Interfaces because they are not `<table>`s.** Their toolbar
sort menu is not a design choice — it is what happens when a shared mechanism is selector-bound to
an element they cannot use (X01-F5). Exempting them ratifies the accident. The `[data-sort-col]`
rule moves off `th` and onto a `[role="columnheader"]`-bearing element, which both a `<th>` and a
grid `<div>` can carry.

## The concrete changes

1. **One label recipe.** The six drifting constructions adopt `.tbl-colhead`:
   `SchemaAutomations.astro:356` + `schemaAutomations.ts:368` · `SchemaRelationships.astro:420` +
   `schemaRelationships.ts:410` · `SchemaInterfaces.astro:358` + `schemaInterfaces.ts:339` ·
   `RecordPanel.astro:764` · `SchemaBrowse.astro:729` · `SpaceHomeView.astro:269,326` ·
   `StaticImport.astro:123`. The three border-top variants collapse to the one `.tbl-colhead` draws.
2. **One sort vocabulary.** `tableSort.ts` gains name-keyed lookup so `SchemaBrowse`'s private
   `data-br-sort` and `DataMedia`'s `data-md-sort` sorters delete. Index-keyed and name-keyed cannot
   both stay: a column moved in markup silently re-points the sort on 20 tables and does nothing on 2.
3. **One indicator.** The shared caret (`global.css:2574-2591`). `SchemaBrowse`'s 8px unicode
   `▲/▼` on its tree head goes — one file, one tab, one user currently sees two glyphs for one idea.
4. **Keyboard and screen reader, in the same change.** Sortable cells take `DataMedia`'s anatomy —
   `<button>` inside the cell — plus `aria-sort` and `scope="col"`. Both are **0** tree-wide today.
   `tableSort.ts:54-55`'s click delegation off a bare `<th>` stays for the mouse and gains nothing
   for the keyboard; the button is what fixes it.
5. **The mechanism reaches a grid head.** `[data-sort-col]` moves off the element name.
   `SchemaHealth`, `SchemaDocs` and `SchemaInterfaces` then sort by header like every other list, and
   their toolbar `btn-square` sort menus are deleted rather than kept as a second path.
6. **Schema Health drops `aria-hidden="true"` from its column band** (X01-F6) — it is the catalog's
   own usageDont, live on a reference surface. Filed against the reference, per the charter.

## Surfaces changed

`SchemaAutomations` · `SchemaRelationships` · `SchemaInterfaces` · `SchemaHealth` · `SchemaDocs` ·
`SchemaBrowse` · `RecordPanel` · `SpaceHomeView` · `StaticImport` · `DataMedia` · `global.css` ·
`lib/tableSort.ts`. **Batch by surface: Schema first (six of the twelve), then Data, then Home.**

## storybook.ts

- `table`: correct the three factual errors the census found — the entry cites `.tbl-colhead` at
  `global.css:809` (it is at **1851**), says the label is **50%** (the CSS says **`/.55`**), and says
  **"20 files declared their own `<th>`"** (it is **24**). Add the `<button>` + `aria-sort` anatomy as
  the required spelling for a sortable column, and the grid-head variant.
- Replace the head row in **all three** table examples (`:1550`, `:2597`, `:3055`) — they demonstrate
  `<tr class="text-xs uppercase tracking-wider text-base-content/60">`, which is the catalog teaching
  the drift and is where `SpaceHomeView.astro:269` came from, verbatim.

## Not changing

`global.css:1859-1868` — the `:is(button, a, span)` re-inheritance **must survive this refactor**;
deleting it silently returns every sortable header to sentence case, and it is the precondition for
the keyboard fix. · `TablePager` (point at it, do not touch it). · The 8px `.br-sortind` size is a
correctly `ds-ok`'d glyph, not text — the *duplication* is the finding, not the size. · The six
`getValue` closures (X01-F16, deferred to D21 unless this work opens one of the six files).

## Verify

`grep -rn 'aria-sort' apps/web/src` is non-zero and equals the sortable-column count ·
`grep -c 'tbl-colhead'` covers every header-declaring file · `grep -rn 'data-br-sort\|data-md-sort'`
→ 0 · Tab onto a column label on `/backups`, press Enter, the table re-sorts and the announced
`aria-sort` flips · `pnpm ds-lint` and `pnpm typecheck` green · **re-census `<th>` and
`.tbl-colhead` at the start of the PR** — both moved between the scout's pass and this ruling.
