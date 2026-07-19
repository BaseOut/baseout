# Tasks

## 1. Schema (packages/db-schema)

- [ ] 1.1 Add `bo_at_pages`, `bo_at_forms`, `bo_at_page_tables`, `bo_at_page_fields`, `bo_at_form_fields` to `src/space/pg.ts`; slim `bo_at_interfaces` (drop `type`, swap `first_seen_at`/`last_seen_at` for the run-based lifecycle set) — columns, uniques, and both-direction indexes per the interface-entity-model spec.
- [ ] 1.2 Mirror all table changes in `src/space/sqlite.ts`; extend `tests/space-schema-parity.test.ts` (and pg-ddl parity) to cover the five new tables + the reshaped `bo_at_interfaces`.
- [ ] 1.3 Generate migrations for both dialects (`migrations/space-pg/`, `migrations/space-sqlite/`); destructive on interface rows is acceptable pre-launch (design Decision 10). Bump `SPACE_SCHEMA_VERSION` so the lazy on-access migrator picks it up.

## 2. Extraction (apps/server, pure)

- [ ] 2.1 Rework `extractInterfaceEntities` in `interfaces-sync.ts`: emit typed apps/pages/forms with column values (`interface_id`, `page_type`, `source_table_id`) + link rows (page↔table, page↔field with `is_editable`); route `pageType==='form'` entities to forms regardless of envelope location; strip normalized keys (`pages`, `tablesByTableId`, `interfaceId`, `pageType`, `sourceTableId`, `sourceTableName`) from persisted definitions, preserving unknown keys.
- [ ] 2.2 Tests (TDD, owner fixture): routing (standalone vs interface-owned forms), link-row extraction incl. empty-fields table entries, definition slimming, unknown-key pass-through, drop-and-count on missing id/name.

## 3. Diff (apps/server, pure)

- [ ] 3.1 Rework `diffInterfaces`: per-table working sets (entities + links), set-delta lifecycle ops (insert / stamp / remove / resurrect), parent→child cascade in the same run, `entity_type` `interface`|`page`|`form` on name/config update ops, config deltas from link-ID sets (never names/options).
- [ ] 3.2 Recompute the capture hash over the normalized representation and reconstruct the prior hash from the stored working set; verify rename-stability (field display-name-only change ⇒ short-circuit).
- [ ] 3.3 Tests: add/remove/rename per entity kind, cascade (interface→pages/forms→links), resurrection round-trip with `first_seen_run` preserved, removal-only-on-successful-capture, rename-echo suppression, unchanged-hash short-circuit.

## 4. Persistence + route (apps/server)

- [ ] 4.1 Rewrite `readInterfaceWorkingSet` / `applyInterfaceDiff` in `space-db-pg.ts` for the six tables (row-id-targeted writes, `submitted_via='mcp'` scope); keep the per-section `interfaceSync` error isolation on the schema-sync route.
- [ ] 4.2 Verify manual rows (`submitted_via`≠`mcp`) are untouched by MCP processing (test: never touches rows it was not given).
- [ ] 4.3 Update `tests/integration/per-space/interfaces-sync.test.ts` fixtures/assertions to the normalized model.

## 5. Cross-references + verification

- [ ] 5.1 Update `openspec/changes/server-mcp-interface-pages/design.md` with a superseded banner on Decision 1 pointing here; note the `entity_type` union widening dependency in `server-schema-changelog`'s tasks; note in `server-schema-entity-graph`'s proposal that "reads" edges should assemble from `bo_at_page_tables`/`bo_at_page_fields`.
- [ ] 5.2 Adapt the deployed smoke (`smoke.mjs` pattern from server-mcp-interface-pages): fixture → six-table inspection → mutate (rename + field removal + page removal) → absent field → identical capture → resurrection → manual-row isolation.
- [ ] 5.3 typecheck + build + targeted suites green (per-space, runs-start); parity tests green in packages/db-schema.
