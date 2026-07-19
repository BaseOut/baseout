# interface-entity-model

Normalized per-Space storage for Airtable Interface apps, pages, and forms: three entity tables plus three ID-link tables, all with run-based lifecycle. Supersedes the one-table model (`bo_at_interfaces` with `type` discriminator and verbatim `definition` blobs) from `server-mcp-interface-pages`.

## ADDED Requirements

### Requirement: Interface apps, pages, and forms are separate per-Space entity tables
The per-Space schema SHALL store Interface entities in three tables: `bo_at_interfaces` (apps — `pbd…` containers only), `bo_at_pages` (interface pages), and `bo_at_forms` (forms). `bo_at_pages` MUST carry `interface_id`, `page_type`, and `source_table_id` as real columns (plain-column references, no FKs — matching the per-Space schema convention). `bo_at_forms` MUST carry `interface_id` (nullable) and `source_table_id`; the payload's `sourceTableName` MUST NOT be persisted (resolved by joining `bo_at_tables`). All three tables MUST exist in both dialects (`pg.ts` and `sqlite.ts`) with parity-test coverage.

#### Scenario: Page row shape
- **WHEN** an interface page (`pag…`) from a capture is persisted
- **THEN** a `bo_at_pages` row exists with `airtable_entity_id`, `base_id`, `interface_id` = its parent `pbd…` id, `page_type`, and `source_table_id` as queryable columns — none of these values live only inside a jsonb blob

#### Scenario: bo_at_interfaces holds apps only
- **WHEN** a capture containing apps, pages, and standalone forms is persisted
- **THEN** `bo_at_interfaces` contains rows only for `pbd…` app containers, and contains no `type` discriminator distinguishing pages or forms

### Requirement: Entities with pageType form are routed to the forms table
Any captured entity whose `pageType` is `form` SHALL be persisted to `bo_at_forms`, regardless of whether it arrived in `standaloneForms[]` (persisted with `interface_id` NULL) or inside an interface's `pages[]` (persisted with `interface_id` set). Non-form pages SHALL be persisted to `bo_at_pages`.

#### Scenario: Standalone form
- **WHEN** a `standaloneForms[]` entry with `interfaceId: null` is persisted
- **THEN** it becomes a `bo_at_forms` row with `interface_id` NULL and `source_table_id` populated, and no `bo_at_pages` row is created for it

#### Scenario: Interface-owned form page
- **WHEN** an interface's `pages[]` entry has `pageType: 'form'`
- **THEN** it becomes a `bo_at_forms` row with `interface_id` set to the parent interface, and no `bo_at_pages` row is created for it

### Requirement: Page and form usage of tables and fields is stored as ID links
The per-Space schema SHALL provide three typed link tables storing IDs only: `bo_at_page_tables` (`page_id`, `table_id`; unique on the pair), `bo_at_page_fields` (`page_id`, `table_id`, `field_id`, `is_editable`; unique on `(page_id, field_id)`), and `bo_at_form_fields` (`form_id`, `table_id`, `field_id`, `is_editable`; unique on `(form_id, field_id)`). Field names, types, and options MUST NOT be duplicated on link rows — they are resolved by joining `bo_at_fields`/`bo_at_tables`. The page-scoped `isEditable` flag MUST be preserved on the link row (it does not exist on `bo_at_fields`). Each link table MUST be indexed in both directions (by source entity and by destination table/field id). `bo_at_form_fields` is created in this change and remains unpopulated until a form-schema capture path exists.

#### Scenario: Page field usage persisted as links
- **WHEN** a captured page's `tablesByTableId` lists table `tblX` with fields `fldA` (isEditable false) and `fldB` (isEditable true)
- **THEN** `bo_at_page_tables` has one row (page, tblX) and `bo_at_page_fields` has rows (page, tblX, fldA, false) and (page, tblX, fldB, true), and no field name, type, or options value is stored on any of those rows

#### Scenario: Table entry with no listed fields
- **WHEN** a page's `tablesByTableId` contains a table entry whose `fields` array is empty
- **THEN** a `bo_at_page_tables` row is still created for that (page, table) pair

#### Scenario: Reverse lookup
- **WHEN** querying which pages display field `fldA`
- **THEN** an index on `bo_at_page_fields.field_id` supports the lookup without a full scan

### Requirement: Interface entity and link tables use run-based lifecycle columns
All six tables (`bo_at_interfaces`, `bo_at_pages`, `bo_at_forms`, `bo_at_page_tables`, `bo_at_page_fields`, `bo_at_form_fields`) SHALL carry the run-based lifecycle set: `status` (`active` | `removed` | `unknown`), `first_seen_run`, `first_unseen_run`, `last_seen_run` (referencing `bo_at_base_runs.id` as plain uuid columns). These tables MUST NOT carry `first_seen_at`/`last_seen_at` timestamp columns — observation timestamps are derived by joining `bo_at_base_runs`. Entity tables retain `submitted_via` so the dual-source (MCP + manual) model remains expressible.

#### Scenario: Timestamps derive from runs
- **WHEN** presenting when a page was last observed
- **THEN** the timestamp comes from joining `bo_at_pages.last_seen_run` to `bo_at_base_runs`, not from a timestamp column on the page row

### Requirement: Persisted definitions exclude data normalized into columns and links
Entity rows MAY retain a `definition` jsonb for unknown-key pass-through (envelope tolerance), but keys normalized elsewhere — `pages`, `tablesByTableId`, `interfaceId`, `pageType`, `sourceTableId`, `sourceTableName` — MUST be stripped before persist.

#### Scenario: No schema detail in stored definitions
- **WHEN** any interface, page, or form row is read after a capture is persisted
- **THEN** its `definition` contains no `tablesByTableId` content and no field names/types/options

#### Scenario: Unknown keys survive
- **WHEN** Airtable adds a new key to the page payload that the extractor does not recognize
- **THEN** that key is preserved in the page row's `definition`
