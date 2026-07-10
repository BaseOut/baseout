# web-schema-export — tasks

## Status

IN PROGRESS — 2026-07-10 (promotion build; awaiting human smoke).

## 1. CSV module — TDD

- [x] 1.1 RED: `src/lib/csv.test.ts` — escapeCsvCell neutralises leading
      `=` `+` `-` `@` TAB CR LF and doubles quotes; formatCsv quotes every
      cell, joins CRLF, optional BOM; exportFilename slugs + ISO date
      (injected clock). 16 tests.
- [x] 1.2 GREEN: `src/lib/csv.ts` copied verbatim from
      `apps/design/src/lib/csv.ts` (diff-clean).

## 2. ExportControl pattern

- [x] 2.1 `patterns/ExportControl.astro` — Dan's markup/classes/ids/aria
      verbatim; go-handler adapted to dispatch cancelable `schema:export`
      (preventDefault ⇒ real download happened ⇒ success live-text; otherwise
      honest "ships with its backend"); heavy branch + `schema:exportQueued`
      unchanged; `total` read live for lazy tabs.
- [x] 2.2 Styles extracted to `styles/components/export-control.css` (scoped
      `<style>` forbidden in tracked components) + `facet-filter.css` brought
      over verbatim from ui-only; both imported in `global.css` in that order.
- [x] 2.3 `ExportControl.stories.ts` — csv, pdf (no rowSelector), heavy
      (total > heavyAbove), image; via shared design fixtures
      (`exportControlVariants` added to `component-catalog.ts`).
- [x] 2.4 `component-classification.json` — `patterns/ExportControl.astro`
      as `storybook-pattern` → `pattern-export-control`, harness
      `pages/schema.astro`.

## 3. Mounts (right-side cluster per tab)

- [x] 3.1 BrowseTab — csv/entities, total = all entities, rows
      `#schema-tree .entity-link`.
- [x] 3.2 ChangelogTab — csv/changes, lazy total written back after fetch,
      rows `#cl-content li`.
- [x] 3.3 RelationshipsTab — csv/relationships, lazy total after fetch, rows
      `#rel-content li`.
- [x] 3.4 HealthTab — pdf/bases, own right-aligned row (toolbar rows are
      conditional), no rowSelector.
- [x] 3.5 DocsTab — pdf/documents above the island, no rowSelector.
- [x] 3.6 ChatTab — pdf/threads in the conversation-header cluster, lazy
      total, rows `#chat-threads [data-thread-id]`.
- [x] 3.7 VisualizeTab — image/diagram above the canvas, total 1, no
      rowSelector. (SoonTab skipped by design.)

## 4. Real exporters — TDD

- [x] 4.1 RED: `src/lib/schema-docs/export-rows.test.ts` — entity + changelog
      row shapes, description fallback, removal summaries, breaksData flag.
      8 tests.
- [x] 4.2 GREEN: `export-rows.ts` (pure) + `downloadTextFile` in `lib/ui.ts`.
- [x] 4.3 BrowseTab listener — preventDefault, scope 'filtered' = visible tree
      rows (composes with removed + field-visibility filters), 'all' = whole
      entity index; BOM honored; Blob+anchor download with the panel filename.
- [x] 4.4 ChangelogTab listener — same pattern over `lastEntries` with the
      feed's kind/include-removed/search filter for scope 'filtered'; falls
      through (honest message) before the first fetch.

## 5. Gates + smoke

- [x] 5.1 `pnpm --filter @baseout/web test:unit src/lib/csv.test.ts
      src/lib/schema-docs/export-rows.test.ts` green.
- [x] 5.2 `stories-coverage` + `component-classification` suites green for
      ExportControl (parallel-work failures reported separately).
- [x] 5.3 `pnpm --filter @baseout/web typecheck` — no ExportControl-related
      errors.
- [ ] 5.4 Human smoke: /schema on a managed_pg Space → Browse "Export CSV"
      downloads a file whose formulas open as text; filter fields → counts
      drop; Changelog export respects the kind/search filter; other tabs
      announce the honest fallback.

## Deferred follow-ups

- [ ] Visualize PNG bake (React Flow toPng: whole graph, background + scale).
- [ ] Health / Docs / Chat PDF generation (reports backend).
- [ ] Heavy-export async pipeline + Inbox delivery (`schema:exportQueued`).
- [ ] Real Space name in the filename (SchemaView only carries spaceId).
