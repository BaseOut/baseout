## ADDED Requirements

### Requirement: Keyset-paginated record reads

The engine SHALL serve a table's backed-up records via `GET /data/tables/:tableId/records` with keyset pagination (opaque cursor, max page size 200), typed field filters (text/number/date/select/checkbox/linked operators, AND semantics, parameterized SQL only), sort, column projection, and a total count that MAY be approximate above a threshold (flagged `approximate: true`). Offset pagination SHALL NOT be offered.

#### Scenario: Page through a filtered million-row table

- **WHEN** a client requests records with two field filters and follows the returned cursor
- **THEN** each page returns matching rows in stable order with no duplicates or gaps across pages

### Requirement: Record detail and history

The engine SHALL serve a record's current field values + attachment metadata, and its history — created/deleted markers from `first_seen_run`/`first_unseen_run` and per-run per-field before → after entries reconstructed from `bo_at_record_updates` and current `bo_at_record_field_data` — including an "as of run R" view.

#### Scenario: Reconstruct a mutated record

- **WHEN** a record was created in run 1, edited in runs 3 and 5, and a field cleared in run 6
- **THEN** history returns a created marker and three update entries with correct before/after values, and "as of run 4" returns the values as they stood after run 3

### Requirement: Linked-record expansion

The engine SHALL expand a linked-record cell (`GET /data/records/:recordId/links/:fieldId`) to the records its id list points to — primary-field display plus preview values — with keyset pagination over the id list and search scoped to the linked set, sized for cells holding thousands of links. Ids whose records are deleted or absent SHALL return as `{missing: true}` rows rather than being dropped.

#### Scenario: Page and search a large link set

- **WHEN** a client expands a link cell holding 10,000 ids with a search term
- **THEN** matching linked records return in pages, and a deleted linked record appears flagged missing

### Requirement: Formula and lookup provenance

The engine SHALL serve cell provenance (`GET /data/records/:recordId/provenance/:fieldId`) from captured field options: for formula cells, the expression plus each referenced field (`referencedFieldIds`) with this record's current value; for lookup/rollup cells, the traversed link field, source table, source record(s) with the looked-up field's value each, and the aggregation kind for rollups. Resolution SHALL be one level per call (no server-side recursion); options captures lacking reference metadata SHALL return null provenance with a reason, never inferred by parsing expression text.

#### Scenario: Formula inputs resolve

- **WHEN** a client requests provenance for a formula referencing three fields
- **THEN** the response carries the expression and three entries with the record's current values for those fields

#### Scenario: Lookup source resolves

- **WHEN** a client requests provenance for a lookup cell
- **THEN** the response names the link field and source table and lists the source records with their looked-up values

### Requirement: Space-wide changelog

The engine SHALL serve per-run created/updated/deleted rollups (created = `first_seen_run`, deleted = `first_unseen_run`, updated = distinct records in `bo_at_record_updates` for the run) with paginated row lists, filterable by base, table, field, change type, and run range.

#### Scenario: Rollup for one run

- **WHEN** a client requests the changelog for the latest run
- **THEN** counts equal the records actually created, updated, and deleted in that run, and row lists paginate

### Requirement: Cross-entity search

The engine SHALL search field values and field names across all bases/tables in a Space (or a subset), returning results grouped base → table with per-group caps and counts, within a bounded scan budget; responses exceeding the budget SHALL be flagged `partial: true`.

#### Scenario: Value found in two bases

- **WHEN** a client searches a value present in tables of two bases
- **THEN** results group by base and table with per-group counts and capped rows

### Requirement: Filtered CSV and JSON export

The engine SHALL export a scope respecting active filters — CSV for single-table scopes, JSON for any scope — streaming synchronously below a size threshold and as an async Space-scoped job above it (status pollable, output written to the Space's storage destination). Attachment cells SHALL export as backup-file references, never re-downloaded bytes. Exports SHALL never buffer the full result set in memory.

#### Scenario: Large async export

- **WHEN** a client exports a 500k-row filtered scope as JSON
- **THEN** a job is returned, progresses to complete, and the artifact contains exactly the matching records

### Requirement: Consent-gated static-snapshot ingest

For static-only Spaces, the engine SHALL load a backup snapshot's CSV files into a temporary per-Space review store only upon a verified, per-snapshot user consent, parsing and type-coercing against the snapshot's captured schema. The review copy SHALL be served through the standard read/search/export machinery (history, changelog, and chat excluded), SHALL expire on an idle TTL and be purgeable on demand with real deletion, and ingest and purge SHALL both be audit-logged.

#### Scenario: Ingest, browse, purge

- **WHEN** a static-only user consents to reviewing a snapshot
- **THEN** its tables become browsable with filters/search/export, links into non-ingested tables return a missing-table fallback, and after purge (manual or TTL) no snapshot data remains in the review store

### Requirement: Record-data AI context gated by the AI-usage policy

Record data SHALL be includable in chat/AI context only when the effective AI-usage policy (per `shared-ai-controls`: Org ceiling + Space restriction) is `all` — enforced at the route guard and re-asserted inside the context assembler immediately before the payload is built. The context SHALL be the scoped/filtered rows with a hard cap on rows × fields. At `schema_only` the assembler SHALL include schema metadata and docs only (the prior posture); at `off` no AI payload SHALL be assembled.

#### Scenario: Policy allows data context

- **WHEN** a Space with effective policy `all` sends a data-scoped chat message over a filtered view
- **THEN** the assembled context contains the capped row slice for that scope

#### Scenario: Policy blocks data context

- **WHEN** the same Space is restricted to `schema_only` and sends a data-scoped message
- **THEN** the request is rejected with `ai_disabled_by_policy` and no record data reaches the assembler
