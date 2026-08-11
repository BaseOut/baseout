# web-schema-export — One export control on every Schema tab

## Status

IN PROGRESS — 2026-07-10, promotion from the ui-only design round
(ui-only@3153dfd; see shared/internal/ui-sync.md §4 promotion matrix).

## Why

Every Schema tab needs an export, and the design rounds had grown divergent,
hand-rolled, dead format pickers per tab. Dan's round answers this with ONE
pattern — `ExportControl` — where the trigger names the tab's single format
("Export CSV" / "Export image" / "Export PDF"), the panel shows BOTH scope
counts (current view vs everything) so "keeps your filters" is verifiable, zero
matches disables with a reason, and the filename encodes the scope. The design
mirror deliberately faked every download ("this preview has no backend"); the
promotion's job is to keep Dan's markup verbatim and make the confirm REAL
wherever a tab's data is already client-available.

**CSV injection is the load-bearing detail.** Airtable formula fields literally
begin with `=`; exporting them raw is an OWASP formula-injection vector AND
silently corrupts the documentation we claim to produce (the spreadsheet
evaluates instead of showing). `lib/csv.ts` quotes every cell, doubles embedded
quotes (RFC-4180), and neutralises leading `=` `+` `-` `@` TAB CR LF with an
apostrophe; the panel says so ("Formulas export as text, never evaluated").
UTF-8 without BOM by default; an "Opening in Excel" toggle adds it.

## What Changes

- **`apps/web/src/lib/csv.ts`** — verbatim copy of the design module
  (escapeCsvCell / formatCsv / exportFilename), TDD'd first.
- **`patterns/ExportControl.astro`** — Dan's markup/classes/ids verbatim; ONLY
  the confirm handler is adapted: it dispatches a cancelable
  `schema:export` CustomEvent (`{ tab, format, scope, count, filename }`) on
  `document`. A tab that `preventDefault()`s performed a real download; tabs
  without a listener fall through to an honest "ships with its backend"
  live-region message. The heavy/async degrade (`schema:exportQueued`) is
  unchanged. `total` reads live from `data-export-total` so lazy-loaded tabs
  (Changelog / Relationships / Chat) can write their real totals after fetch.
- **Panel styles extracted** to `styles/components/export-control.css` —
  component governance forbids scoped `<style>` blocks in tracked components —
  and the shared facet language lands as `styles/components/facet-filter.css`
  (verbatim from ui-only, its destined path).
- **Mounted on all seven live Schema tabs** in each toolbar's right-side
  cluster (Dan's `sch-tb-right` idiom where no toolbar exists): browse
  csv/entities, changelog csv/changes, relationships csv/relationships, health
  pdf/bases, docs pdf/documents, chat pdf/threads, visualize image/diagram.
- **Real CSV downloads** where the data is client-side: Browse (entity index →
  base/table/field/type/description/status) and Changelog (fetched entries →
  at/base/table/field/changeType/summary), both scope-aware, via the pure
  `lib/schema-docs/export-rows.ts` builders + `downloadTextFile` in `lib/ui.ts`.
- **Catalog**: `ExportControl.stories.ts` (csv / pdf / heavy / image, shared
  design fixtures) + `component-classification.json` entry
  (`pattern-export-control`, harness `pages/schema.astro`).

## Capabilities

### New Capabilities

- `schema-export`: every Schema tab carries one scope-aware, format-named,
  injection-safe export control; Browse and Changelog download real CSVs today,
  the remaining tabs announce honestly until their export backends land.

## Impact

- `apps/web`: `src/lib/csv.ts` (+test), `src/lib/ui.ts` (downloadTextFile),
  `src/lib/schema-docs/export-rows.ts` (+test),
  `src/components/patterns/ExportControl.astro` (+stories),
  `src/components/component-classification.json`,
  `src/styles/global.css` + `src/styles/components/{facet-filter,export-control}.css`,
  `src/views/schema/{Browse,Changelog,Relationships,Health,Docs,Chat,Visualize}Tab.astro`.
- `apps/design`: `src/fixtures/component-catalog.ts` (shared story fixtures);
  the `pattern-export-control` styleguide entry landed via parallel work.
- No server change, no DB change, no new secrets.
- **Deferred:** Visualize's real PNG bake (whole graph, background/scale — needs
  a React Flow `toPng` seam in SchemaCanvas); Health/Docs/Chat PDF generation
  (reports backend); the heavy-export async pipeline + Inbox delivery; passing
  the real Space name into the filename (SchemaView carries only `spaceId`
  today, so filenames slug the default "Space").
