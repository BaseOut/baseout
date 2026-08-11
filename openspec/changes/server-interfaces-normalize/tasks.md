# Tasks

## 1. Schema (packages/db-schema)

- [x] 1.1 Add `bo_at_pages`, `bo_at_forms`, `bo_at_page_tables`, `bo_at_page_fields`, `bo_at_form_fields` to `src/space/pg.ts`; slim `bo_at_interfaces` (drop `type`, swap `first_seen_at`/`last_seen_at` for the run-based lifecycle set) — columns, uniques, and both-direction indexes per the interface-entity-model spec.
- [x] 1.2 Mirror all table changes in `src/space/sqlite.ts`; extend `tests/space-schema-parity.test.ts` (and pg-ddl parity) to cover the five new tables + the reshaped `bo_at_interfaces`. (Parity test reflects over the modules — auto-covers; ddl-parity + idempotent-set counts bumped 29→34.)
- [x] 1.3 Generate migrations for both dialects (`migrations/space-pg/`, `migrations/space-sqlite/`); destructive on interface rows is acceptable pre-launch (design Decision 10). Bump `SPACE_SCHEMA_VERSION` (6→7) so the lazy on-access migrator picks it up; add the version-gated destructive `DROP TABLE bo_at_interfaces` pre-step to `apps/server/.../provisioning/upgrade.ts` (the idempotent DDL alone can't reshape an existing table) + its test.

## 2. Extraction (apps/server, pure)

- [x] 2.1 Rework `extractInterfaceEntities` in `interfaces-sync.ts`: emit typed apps/pages/forms with column values (`interface_id`, `page_type`, `source_table_id`) + link rows (page↔table, page↔field with `is_editable`); route `pageType==='form'` entities to forms regardless of envelope location; strip normalized keys (`pages`, `tablesByTableId`, `interfaceId`, `pageType`, `sourceTableId`, `sourceTableName`) from persisted definitions, preserving unknown keys.
- [x] 2.2 Tests (TDD, owner fixture): routing (standalone vs interface-owned forms), link-row extraction incl. empty-fields table entries, definition slimming, unknown-key pass-through, drop-and-count on missing id/name.

## 3. Diff (apps/server, pure)

- [x] 3.1 Rework `diffInterfaces`: per-table working sets (entities + links), set-delta lifecycle ops (insert / stamp / remove / resurrect), parent→child cascade in the same run, `entity_type` `interface`|`page`|`form` on name/config update ops, config deltas from link-ID sets (never names/options).
- [x] 3.2 Recompute the capture hash over the normalized representation and reconstruct the prior hash from the stored working set; verify rename-stability (field display-name-only change ⇒ short-circuit).
- [x] 3.3 Tests: add/remove/rename per entity kind, cascade (interface→pages/forms→links), resurrection round-trip with `first_seen_run` preserved, removal-only-on-successful-capture, rename-echo suppression, unchanged-hash short-circuit. (37 pure tests green.)

## 4. Persistence + route (apps/server)

- [x] 4.1 Rewrite `readInterfaceWorkingSet` / `applyInterfaceDiff` in `space-db-pg.ts` for the six tables (row-id-targeted writes for entity tables, natural-key upsert for link tables, `submitted_via='mcp'` scope); keep the per-section `interfaceSync` error isolation on the schema-sync route. Also adapted `schema-changelog-io.ts` (interface removals now run-based across all three entity tables) + widened `ChangelogEntityType` to `page`/`form`.
- [x] 4.2 Verify manual rows (`submitted_via`≠`mcp`) are untouched by MCP processing (readInterfaceWorkingSet scopes to `submitted_via='mcp'`; pure test "never touches rows it was not given" — empty prior ⇒ all inserts, no seen).
- [x] 4.3 Update `tests/integration/per-space/interfaces-sync.test.ts` fixtures/assertions to the normalized model.

## 5. Cross-references + verification

- [x] 5.1 Update `openspec/changes/server-mcp-interface-pages/design.md` with a superseded banner on Decision 1 pointing here; note the `entity_type` union widening dependency in `server-schema-changelog`'s tasks; note in `server-schema-entity-graph`'s proposal that "reads" edges should assemble from `bo_at_page_tables`/`bo_at_page_fields`.
- [x] 5.2 Adapt the deployed smoke (`openspec/changes/server-interfaces-normalize/smoke.mjs`): fixture → six-table inspection → mutate (rename + field removal) → page/form removal (cascade) → absent field → identical capture → resurrection (first_seen_run preserved) → manual-row isolation. (Written + syntax-checked; runs against deployed dev engine — surfaced for human smoke.)
- [x] 5.3 typecheck (db-schema + server) + build (server) green; targeted suites green (interfaces-sync 37, schema-changelog 8, upgrade 8); parity + ddl-parity green in packages/db-schema (9). Pre-existing unrelated failures: 4 DO crypto/proxy teardown + 1 backup_runs schema-mirror (not touched by this change).
