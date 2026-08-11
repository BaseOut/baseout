# interface-pages-sync

Capture → extract → diff → persist behavior for MCP interface captures against the normalized entity/link model. Supersedes `openspec/changes/server-mcp-interface-pages/specs/interface-pages-sync/spec.md` (built, un-archived): the wire contract and envelope-tolerance invariants carry forward unchanged; the persistence target and diff granularity change.

## ADDED Requirements

### Requirement: Schema-sync accepts the interfacePages field and persists to the normalized model
The schema-sync route SHALL continue to accept the optional `interfacePages` field (`{ capturedAt, raw }`, the MCP `list_pages_for_base` envelope forwarded verbatim by workflows — wire contract unchanged). Extraction SHALL emit typed entities (apps, pages, forms) plus link rows (page↔table, page↔field with `is_editable`), persisted to the six normalized tables inside the same `withSpaceSchema` transaction as the run's schema diff. An absent field means no interface processing; a malformed field is reported per-section (`interfaceSync: {ok:false, reason}`) without failing schema sync. Entities lacking a string id + name are dropped and counted; unknown envelope keys pass through into slimmed definitions.

#### Scenario: Full capture persisted
- **WHEN** schema-sync receives a valid capture with one app, two pages, and one standalone form
- **THEN** one `bo_at_interfaces`, two `bo_at_pages`, and one `bo_at_forms` row exist with `submitted_via='mcp'`, link rows exist for every table/field the pages reference, and all rows carry the run's lifecycle stamps

#### Scenario: Malformed capture never fails the sync
- **WHEN** `interfacePages.raw` is not a valid envelope
- **THEN** the schema sync succeeds, no interface rows change, and the response carries `interfaceSync: {ok:false}`

### Requirement: Removal only on confident full capture, per diff scope
The diff SHALL treat every successful capture as a full enumeration of the base's interface entities and their links. An id present in the capture SHALL be stamped `last_seen_run` (inserted with `first_seen_run` if new). An id absent from a successful capture SHALL be set `status='removed'` with `first_unseen_run`. A failed, partial, or absent capture SHALL NOT change any lifecycle state (never false-delete). MCP diffing SHALL consider only `submitted_via='mcp'` rows; manual rows are never touched.

#### Scenario: Field removed from a still-present page
- **WHEN** the next capture lists the page but its `tablesByTableId` no longer contains `fldA`
- **THEN** the (page, fldA) `bo_at_page_fields` row becomes `status='removed'` with `first_unseen_run` set to this run, and other link rows are stamp-only

#### Scenario: Absent capture changes nothing
- **WHEN** schema-sync runs without an `interfacePages` field
- **THEN** no interface entity or link row's status or run stamps change

### Requirement: Parent removal cascades to children in the same run
When a parent entity is marked removed by the diff, its children SHALL be marked removed in the same run: an interface's pages and forms, and a page's/form's link rows. No `active` link row may reference a `removed` parent after a successful sync.

#### Scenario: Page disappears
- **WHEN** a page id is absent from a successful capture
- **THEN** the page row and all its `bo_at_page_tables`/`bo_at_page_fields` rows become `removed` with the same `first_unseen_run`

### Requirement: Reappearing entities resurrect
An entity or link id present in a capture whose prior row is `removed` SHALL return to `status='active'` with `last_seen_run` restamped (`first_seen_run` preserved). Republishing a page restores its link rows the same way.

#### Scenario: Republished page
- **WHEN** a previously-removed page id appears in a new successful capture
- **THEN** its row and its captured link rows are `active` again, and the original `first_seen_run` is unchanged

### Requirement: Removed status records observation, not interpretation
For interfaces, pages, and forms, `removed` SHALL mean exactly "absent from a confident full capture" — the system MUST NOT persist a guessed distinction between deleted and unpublished (the API cannot distinguish them). Presentation layers SHALL describe removed interfaces/pages/forms as no longer visible (unpublished or deleted); link rows under a still-present parent are unambiguously removed.

#### Scenario: No unpublished status value
- **WHEN** a page disappears from the capture because its interface was unpublished
- **THEN** its stored status is `removed` (not `unpublished`), and the ambiguity is a presentation concern

### Requirement: Changes produce schema_updates rows with widened entity types
Name changes SHALL produce `bo_at_schema_updates` rows (`change_type='name'`, before/after) and composition changes (`page_type`, `source_table_id`, link add/remove summary, `is_editable` flips) SHALL produce `change_type='config'` rows storing the delta — with `entity_type` set to `interface`, `page`, or `form` per the entity's table. Add/remove remain lifecycle-only (no update rows). Composition comparison SHALL use field/table IDs only, never names or options.

#### Scenario: Rename echo suppression
- **WHEN** a schema-side field rename changes field names inside page payloads but no field ids
- **THEN** zero interface-related `bo_at_schema_updates` rows are produced

#### Scenario: Form rename
- **WHEN** a form's name changes between captures
- **THEN** a `bo_at_schema_updates` row exists with `entity_type='form'`, `change_type='name'`, and the before/after values

### Requirement: Identical captures short-circuit and the hash is rename-stable
The diff SHALL compute a capture hash over the normalized representation (entity columns + link IDs + `is_editable` + slimmed definitions) and short-circuit entirely when it matches the hash reconstructed from the stored working set — still stamping `last_seen_run` on active rows. Because field names/options are excluded, a schema-side field rename MUST NOT invalidate the hash.

#### Scenario: Unchanged capture
- **WHEN** the same envelope is captured twice in consecutive runs
- **THEN** the second sync performs stamp-only updates and writes zero `bo_at_schema_updates` rows

#### Scenario: Rename does not break the short-circuit
- **WHEN** the only difference between two captures is field display names inside `tablesByTableId`
- **THEN** the hash matches and the diff short-circuits
