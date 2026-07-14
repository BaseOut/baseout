## ADDED Requirements

### Requirement: schema-sync persists MCP-captured interface entities

The engine's schema-sync endpoint SHALL accept an optional `interfacePages` field (raw MCP capture + `capturedAt`). When present, the engine SHALL extract one entity per Interface app, per page, and per standalone form, and upsert them into `bo_at_interfaces` keyed by `airtable_entity_id` with `submitted_via='mcp'`, stamping `first_seen_at` on first appearance and `last_seen_at` on every successful capture, in the same transaction and run association as the schema diff. An absent `interfacePages` field SHALL cause no interface processing whatsoever.

#### Scenario: First capture of a base with interfaces

- **WHEN** schema-sync receives a first-ever `interfacePages` capture containing one Interface app with two pages
- **THEN** three `bo_at_interfaces` rows exist (one app, two pages) with `submitted_via='mcp'`, first/last seen set, and page definitions carrying `pageType`, `sourceTableId`, and `tablesByTableId`

#### Scenario: Capture omitted

- **WHEN** schema-sync receives a payload without `interfacePages` (old workflows or a skipped capture)
- **THEN** existing interface rows are untouched — no removals, no updates, no events

### Requirement: Run-over-run interface diffing feeds the schema changelog

On each successful capture the engine SHALL diff MCP-sourced interface entities against the prior working set: entities appearing/disappearing SHALL be recorded via lifecycle (removal only on a successful capture in that run); name changes SHALL write `bo_at_schema_updates` rows with `entity_type='interface'`, `change_type='name'`; `pageType`, `sourceTableId`, and per-page field-usage changes (field ids added/removed, `isEditable` flips) SHALL write `change_type='config'` rows storing the delta. Composition diffs SHALL compare field ids only, so schema-side field renames do not produce per-page noise. An unchanged capture (identical hash) SHALL short-circuit diffing while still stamping `last_seen_at`.

#### Scenario: Page deleted in Airtable

- **WHEN** a capture no longer contains a previously-seen page
- **THEN** that page's row is marked removed with `last_seen_at` at this run, and the changelog shows an interface `removed` event for this run

#### Scenario: Field added to a page

- **WHEN** a page's `tablesByTableId` gains a field id relative to the prior capture
- **THEN** one `config` update row records the field-usage delta for that page

#### Scenario: Schema rename does not echo

- **WHEN** a field is renamed in Airtable but page field ids are unchanged
- **THEN** no interface `config` rows are written for pages referencing that field

### Requirement: Manual submissions are never clobbered by MCP captures

MCP diffing SHALL consider only `submitted_via='mcp'` rows. A manually-submitted interface row for the same `airtable_entity_id` SHALL be preserved unmodified alongside the MCP row.

#### Scenario: Manual then MCP

- **WHEN** an interface was manually submitted and a later backup captures the same entity id via MCP
- **THEN** both rows exist — the manual row byte-identical to before, the MCP row carrying capture lifecycle

### Requirement: Interface capture is tier-gated at run assembly

The engine SHALL include `interfaces_enabled` in the backup task payload, true only when the Space's resolved capabilities include interface backup (Growth+).

#### Scenario: Launch-tier Space

- **WHEN** a run is assembled for a Space below Growth
- **THEN** the task payload carries `interfaces_enabled: false`
