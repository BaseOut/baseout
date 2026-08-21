# X17 — The table convergence is finished, and the answer is that the six hold-outs are exclusions

**Date:** 2026-08-15. Four independent assessments, one per file group, each required to produce
evidence rather than a migration.

## The verdict

Sixteen files render through `components/ui/Table.astro`. **Six hold out, and none of them can
migrate.** That is not six failures — it is the boundary of what the vessel is, discovered by
trying. The vessel converges **server-rendered** tables. Every hold-out is one of three other things.

| File | Why it cannot migrate | Class |
|---|---|---|
| `data/DataBrowse.astro` | `renderHead()` sets `thead.innerHTML` outright (`:1163`) — a vessel-rendered header survives **zero** paints. The column SET is runtime state: hidden columns drop the `<th>` (`:1158`), `colOrder` reorders, the `REC` pseudo-column appears with `showRecId` (`:1150`), and the active preset is restored from **localStorage**, so even the first paint is unknown to the server. Sort keys on the field id, not the array index, *because* an index moves when a column is hidden. | runtime header |
| `data/StaticImport.astro` | Fails the vessel's FIRST refusal: `columns: []` throws (`contract.ts:101`), and at SSR **no table is selected yet** — step 1 is a Base▸Table picker, step 3 is `hidden` until import. A placeholder would invent a header for a table that does not exist. | runtime header |
| `data/RecordPanel.astro` | The table is an `innerHTML` string from `vtBody()` (`:199`), re-emitted on every panel move and every search keystroke. An Astro component has no reach into browser-built HTML. | runtime header |
| `data/DataMedia.astro` | Two tables. `:1413` is `innerHTML` from client script and needs a `<colgroup>` for cross-card `table-layout: fixed` alignment, which the vessel has no channel for. `:405` could migrate alone — and must not, because that leaves **two header vocabularies in one file**, the exact drift the vessel exists to remove. | runtime header |
| `data/DataComments.astro` | **Has no `<table>` at all.** The feed is the shared changelog-timeline CSS grid at `global.css:1624-1657`, which Schema▸Changelog also renders. A `<table>` here forks that shared grid. It already honours the vessel's contract by hand: `.tbl-colhead`, real `<button>` sorts carrying `data-sort-col`, `role="button"` rows. | not a table |
| `schema/SchemaHealth.astro` | The raw `<table>` (`:397`) is the per-severity issues list and has **no `<thead>`** — three unlabelled columns. The vessel throws on empty `columns` and renders `<thead>` unconditionally. Migrating means inventing three visible labels under every group head: a visible redesign, not a swap. | headless |
| `schema/SchemaInterfaces.astro` | **Is a table**, and the catalog already says so (`pattern-schema-automations-interfaces`). Blocked on one thing: sort, pager and collapse all operate on `.if-node`, the wrapper keeping a parent with its pages. `Table.astro` emits one `<tbody>`; `<tr>`s cannot be wrapped in a div. | tree |

## What we should NOT do about it

Three of the four assessments proposed the same vessel extension — a runtime-header mode, a
`sortKey` alternative to index-keyed sort, a `headless` flag, a caller-supplied `<tbody>`. Adding all
four turns a vessel whose stated job is "make the wrong thing unreachable" into a configuration
surface that can express anything, which is the same as expressing nothing. `Table.astro`'s own
header names the goal: **one implementation, not one file count.**

The honest shape, if this is picked up:

- **The runtime-header class is four files with one problem.** The fix is not a vessel flag — it is
  `lib/table/renderHeadCells.ts`, one emitter producing the same `<th>` string the vessel produces,
  so the header construction stays singular even though it is built in the browser. Prerequisite:
  `.tbl-sortbtn`'s reset and focus ring must move from `Table.astro`'s `is:global` block to
  `styles/global.css`, or a runtime header on a page with no `<Table>` gets no CSS.
- **The tree class is `SchemaInterfaces` + `SchemaBrowse` + `SchemaRelationships`.** `<tbody>` does
  not nest, and Browse's tree is three levels — so a tbody prop buys exactly one file. This is the
  open question for Oleh: a `TreeTable` sibling, or tree listings declared an excluded class that
  shares *behaviour* (keyboard, header type, narrow) without sharing the vessel.

## What DID converge, without the vessel

The point was never the component. It was the guarantees. Applied in place: `scope="col"` and live
`aria-sort` on `DataBrowse`'s runtime `<th>`s; `.tbl-colhead` on `StaticImport` (load-bearing —
`.si-table thead th` at 0,1,2 out-specified `.tbl-colhead th` at 0,1,1, and the duplicated rule had
drifted to `.65` against the shared `.55`); `scope="col"` + `.tbl-colhead` + `data-table` on
`RecordPanel`.

## Defects this pass found, which are the real yield

1. **`labelSlot` was dead.** Declared `contract.ts:40`, documented at length, rendered by nothing —
   and unbuildable as designed, since a markup-bearing prop sits in `.astro` frontmatter, which
   `lib/ui.ts` records as fatal ("read by Astro's scanner as JSX and breaks the build"). **Fixed**:
   now a boolean marking which `<th>` receives a `col-extra` named slot.
2. **`SchemaAutomations` declared `growth="fixed"`** while its own comment said that was wrong and
   asked for a third value. `unpaged` was added to the contract *naming this file* — and the caller
   was never updated. **Fixed.**
3. **`SchemaInterfaces`: two live keyboard defects** — sortable heads are `<span>`s (sort unreachable
   by keyboard) and row activation has no interactive-descendant guard (Enter on Delete opens the
   ConfirmModal *and* the entity panel behind it). **Fixed separately.**
4. **`RecordPanel` rows are mouse-only** — `cursor: pointer`, a click handler, no `tabindex`, no
   `role`, no Enter/Space. **Fixed separately.**
5. **`SchemaHealth:312`** — `<div class="hl-metrics-head tbl-colhead" aria-hidden="true">` carrying
   the ONLY column labels on screen, over `role="button"` rows. A screen reader is told to ignore
   them. **Open** — it is a CSS grid, so it is a data-shape decision.
6. **`DataBrowse` sort is still mouse-only** (the header click handler fires on a `<th>`); and
   `.dg-sortind` has never been primary-coloured — `.tbl-colhead th :is(button,a,span){color:inherit}`
   at 0,1,2 out-specifies it at 0,1,0. `css-guard` cannot see this: its check (C) looks for
   **id-bearing** rules in `styles/`, and this shadow is class-bearing. **Open, both.**
7. **`RecordPanel` windows to 50 rows with no pager** — records 51+ are unreachable by anything but a
   search that guesses them. The footer says "50 of N" honestly. **Open** — product decision.

---

## X17b — Registering the FIRST interface inserts it into a detached node

Found incidentally while fixing the keyboard defects, 2026-08-15. **Not fixed — it needs an answer
from the Baseout engineer first, and guessing costs a redesign.**

`schemaInterfaces.ts:374` inserts a newly created Base group like this:

```js
list()?.querySelector('[data-if-nomatch]')?.before(bg);   // list = root.querySelector('[data-if-list]')
```

`[data-if-list]` exists **only** in the non-empty branch (`SchemaInterfaces.astro:206`). The empty
state (`:157-163`) is a different branch entirely — no toolbar, no list, no `[data-if-nomatch]`. So
when the user registers their first interface from that empty state, `list()` is `null`, both `?.`
short-circuit, and the group is built and **silently dropped**. The interface registers and vanishes.

That empty state's whole purpose is that action — its button is `Register interface`, and its copy
says "Register them (and their pages) here".

**The open question, which decides whether this ships broken:** does registering an interface in the
real product do a full server round-trip and re-render (in which case the empty state is replaced by
the full branch and this path never runs), or does it append client-side the way this controller
does? `schemaInterfaces.ts` is `apps/web` — real product code, not harness — so the client-side
append is shipped. But CLAUDE.md records that this repo stubs all server actions, so the append may
be standing in for a server render that exists upstream.

If it is client-side: the fix is not a patch to the insert line. The empty branch has to render the
same shell (toolbar, `.if-list`, `[data-if-nomatch]`, pager) with `.if-empty` inside it as the
zero-row state, so there is always somewhere to insert. That is a restructure of the branch, which is
why it is written down rather than done.

The same shape is worth checking on `SchemaAutomations`, which has a twin empty state and a twin
controller.

---

## X18 — The styleguide breaks its own responsive rule at 390

Measured 2026-08-15 at a real 390 (`emulate`, not `resize_page` — the window floors at ~500px).
`/styleguide#table`:

| | measured |
|---|---|
| `body` overflow | `hidden` on **both** axes |
| page scrolls sideways | **no** (`scrollWidth === clientWidth`) |
| `.sb-guide-table` widths | **605px · 600px · 573px · 555px** in a 390px viewport |
| `.sb-props` | 39px of content in a 31px box, `overflow-x: visible` |
| `.sb-main` reading pane | `overflow-y: visible`, `scrollHeight === clientHeight === 844` |

So four guide tables lay out at ~1.5× the viewport, the page cannot pan to reach them, and the
element itself is not a scroller. The `<pre>` blocks are fine — they carry `overflow-x: auto` and
pan correctly, which is the proof that the fix is known and simply was not applied to the tables.

The irony is the point: `pattern-responsive` in this very catalog says *compare down a column → pan*,
and the page that renders that sentence does not do it.

**Cost of not fixing:** low for customers — `/styleguide` is `apps/design`, a designer/dev surface
that never ships to the product. It matters when the catalog is read on a phone, which is the only
reason it is filed rather than dropped.

**The fix is the one the `<pre>` blocks already use**: wrap each guide table in a container with
`overflow-x: auto`, per `specs/16-responsive.md` §5, and let it pan. It does NOT need a fold.
