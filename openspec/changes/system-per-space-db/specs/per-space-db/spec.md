## ADDED Requirements

### Requirement: Dedicated database per Space

Each Space SHALL have its own dedicated database. The backend SHALL be one of `d1` (Cloudflare D1 / SQLite), `managed_pg` (Baseout-managed Postgres), or `byodb` (customer-provided Postgres), recorded on the master-DB `space_databases` row as `backend`. Whether record data is stored SHALL be a separate boolean `records_enabled`; the per-Space database SHALL exist regardless (it always holds schema, attachments, diffs, and documentation).

#### Scenario: Static/schema-only Space still has a per-Space DB

- **WHEN** a Space is configured for static (file) backup only, with `records_enabled = false`
- **THEN** a per-Space database is still provisioned and populated with schema, attachment metadata, schema history, and documentation; only the record tables are left unpopulated

#### Scenario: Backend recorded per Space

- **WHEN** a Space's per-Space DB is provisioned
- **THEN** `space_databases.backend` is one of `d1 | managed_pg | byodb` and `space_databases.records_enabled` is set independently

### Requirement: Per-Space schema versioning and lazy migration

Each per-Space database SHALL carry a single-row `bo_at_meta` table recording `schema_version` (the `bo_at_*` schema version the database is migrated to) plus self-describing fields (`space_id`, `backend`, `platform`). When the engine opens a per-Space database it SHALL compare `schema_version` to the code's target version and apply any pending migrations in order before proceeding, updating `schema_version` on completion. There SHALL be no central migration runner iterating all per-Space databases.

#### Scenario: Database behind the current schema version

- **WHEN** the engine opens a per-Space DB whose `bo_at_meta.schema_version` is older than the code's target
- **THEN** the pending migrations are applied in order, `schema_version` and `last_migrated_at` are updated, and the operation proceeds

#### Scenario: Untouched databases are not eagerly migrated

- **WHEN** a new schema version ships but a Space has no activity
- **THEN** its per-Space DB stays on its prior version until next access; no central job touches it

### Requirement: Storage posture and residency

The system SHALL treat data residency as a posture derived from `backend`: `managed` (`d1` or `managed_pg`) or `sovereign` (`byodb`, where schema and records reside only in the customer's database, never on Baseout infrastructure). Sovereign posture SHALL require `records_enabled = true` (a dynamic database is mandatory for sovereign).

#### Scenario: Sovereign requires a dynamic DB

- **WHEN** a Space is configured with `backend = byodb` and `records_enabled = false`
- **THEN** the configuration is rejected with an error stating sovereign mode requires a dynamic database

### Requirement: Control-plane / data-plane split

The master DB SHALL hold only operational/control-plane state (organizations, spaces, connections, subscriptions, credits, `backup_configurations`, the overall `backup_runs`, schedules, `storage_destinations`, `space_databases`, `health_score_rules`, `static_snapshots` with opaque keys, `airtable_webhooks`). All Airtable-derived content (schema, records, attachments, diffs, documentation, health results, automations/interfaces) SHALL reside in the per-Space DB. Cross-DB references SHALL be plain UUID columns, never foreign keys.

#### Scenario: Field names never reach the master DB for a sovereign Space

- **WHEN** a sovereign Space captures its schema and records
- **THEN** no Airtable table names, field names, or cell values are written to the master DB; they exist only in the customer's database

### Requirement: Per-Space table naming

All canonical per-Space tables SHALL use the `bo_at_` prefix (`bo_` = Baseout-owned, `at_` = Airtable platform namespace). Generated per-table query views SHALL use the raw Airtable table name. Master-DB tables SHALL NOT use the prefix.

#### Scenario: Generated view does not collide with a canonical table

- **WHEN** a customer has an Airtable table literally named "records"
- **THEN** its generated view is `records` and the canonical cell table remains `bo_at_record_field_data`, with no collision

### Requirement: Engine brokers all per-Space reads

`web` SHALL NOT connect to per-Space databases. All per-Space reads for customer-facing surfaces SHALL be brokered by the engine via internal endpoints, uniform across backends and invisible to posture. The SQL REST API SHALL be the only separate customer-facing broker, querying generated views under a read-only role.

#### Scenario: Schema page reads via the engine regardless of backend

- **WHEN** the Schema page loads for a Space whose backend is `byodb`
- **THEN** `web` calls the engine's internal read endpoint, which connects to the customer DB; `web` never opens a connection to the customer DB itself

### Requirement: Schema capture with lifecycle

For each run, the engine SHALL upsert the current relational schema into `bo_at_bases`, `bo_at_tables`, `bo_at_fields`, and `bo_at_views`, each carrying lifecycle columns `status` (`active | removed | unknown`), `first_seen_run`, `first_unseen_run`, `last_seen_run` (run UUIDs; timestamps derived from `bo_at_base_runs`). An entity SHALL be marked `removed` only when its parent was fully and successfully enumerated; a failed or partial run SHALL leave entities `unknown` and SHALL NOT mark them removed.

#### Scenario: New field detected

- **WHEN** a run captures a field not previously present
- **THEN** a `bo_at_fields` row is inserted with `status = active` and `first_seen_run` set to the run

#### Scenario: Failed enumeration does not delete

- **WHEN** a run fails to fully enumerate a base's tables
- **THEN** the affected entities are set to `status = unknown`, not `removed`, and no removal appears in the changelog

### Requirement: View capture (Airtable Enterprise only)

The system SHALL capture Airtable views into `bo_at_views` only for Spaces whose Airtable plan is Enterprise (the plan at which view metadata is available). For non-Enterprise Airtable customers, `bo_at_views` SHALL remain empty and the rest of the schema model SHALL function without it.

#### Scenario: Non-Enterprise Airtable customer

- **WHEN** a Space's Airtable plan is not Enterprise
- **THEN** views are not captured, `bo_at_views` stays empty, and schema/diagram/changelog still render from bases/tables/fields

### Requirement: Hash-deduplicated schema versions

The engine SHALL maintain `bo_at_schema_versions` holding the full base schema as JSON, inserting a new row only when the base's `schema_hash` differs from the prior run. Each `bo_at_base_runs` row SHALL record the `schema_version_id` and `schema_hash` it observed.

#### Scenario: Unchanged schema does not duplicate

- **WHEN** consecutive runs capture an identical base schema
- **THEN** no new `bo_at_schema_versions` row is created; both base-runs reference the same `schema_version_id`

### Requirement: Schema change log

Schema modifications (not additions/removals, which are lifecycle) SHALL be recorded in `bo_at_schema_updates` with `before_value` and `after_value`, `change_type`, optional `change_type_name`, and a `breaks_data` flag. Schema changes SHALL NOT be written to the master `audit_history`.

#### Scenario: Field retype flagged as breaking

- **WHEN** a field changes type in a way that may invalidate existing values (e.g., single-select → number)
- **THEN** a `bo_at_schema_updates` row is written with before/after types and `breaks_data = true`, which the Changelog renders with a warning

### Requirement: Generic record storage

When `records_enabled`, records SHALL be stored generically: one row per record in `bo_at_records` (with lifecycle and Airtable's actual `created_time`/`modified_time`), and one row per ever-populated cell in `bo_at_record_field_data` keyed by `(record_id, field_id)`. A cell row SHALL be created on first population and persist thereafter (value set to null when cleared); a cell never populated SHALL have no row. The cell value SHALL be stored as a single JSON-encoded `value` column. The system SHALL NOT create one physical table per Airtable table.

#### Scenario: Cleared cell retains its row

- **WHEN** a previously populated cell is cleared in Airtable
- **THEN** its `bo_at_record_field_data.value` is set to null and the row persists (so its change history remains anchored)

#### Scenario: Empty record still tracked

- **WHEN** a record exists with no populated cells
- **THEN** a `bo_at_records` row exists with no `bo_at_record_field_data` rows, and its lifecycle (e.g., deletion) is still tracked

### Requirement: Generated per-table query views

For Spaces with `records_enabled`, the system SHALL expose one query view per Airtable table over `bo_at_record_field_data`, pivoting cells into columns and safe-casting each to its current field type from `bo_at_fields` (cast failures yield null, never a view error). On D1 these SHALL be live views; on managed/BYODB Postgres these SHALL be materialized views refreshed per run.

#### Scenario: Retyped field with non-conforming old values

- **WHEN** a field was retyped and some retained values do not conform to the new type
- **THEN** the generated view casts conforming values and yields null for the rest, without erroring

### Requirement: Record change history (superseded-value log)

Record cell changes SHALL be recorded in `bo_at_record_updates`, storing the superseded (old) value and the run; the new value SHALL live only in `bo_at_record_field_data`. First population SHALL NOT produce a log row. This log SHALL be prunable by simple deletion (retention-based), with history rendered as a timeline whose earliest retained point is the earliest known value.

#### Scenario: Value change logs the old value

- **WHEN** a cell's value changes from V to W
- **THEN** a `bo_at_record_updates` row is appended with `old_value = V` and the run, and `bo_at_record_field_data.value` is set to W

#### Scenario: Field-type correlation derived, not stored

- **WHEN** a cell change coincides with a field type change in the same run
- **THEN** the correlation is determined by joining `bo_at_record_updates` to `bo_at_schema_updates` on `(run_id, field_id)`; no field type is stored on the cell update

### Requirement: Per-Space attachments

Attachment metadata SHALL be stored in the per-Space `bo_at_attachments` (replacing the master `attachment_dedup`), keyed by composite id, with dedup by content hash, and `upload_status`. Attachment binaries SHALL be written to the Space's file destination, not the per-Space DB. This table SHALL be populated regardless of `records_enabled`.

#### Scenario: Attachment dedup within the Space

- **WHEN** the same attachment is seen again in a later run
- **THEN** `bo_at_attachments` is matched by composite id / content hash, the existing `storage_key` is reused, and the binary is not re-downloaded

### Requirement: Restore from per-run snapshots

Restore SHALL read per-run full CSV snapshots from the Space's file destination (written every run). Restore granularity SHALL be per backup run (the user selects from run history). Restore SHALL NOT depend on the prunable `bo_at_record_updates` log.

#### Scenario: Restore after history pruning

- **WHEN** `bo_at_record_updates` has been pruned but the chosen run's CSV snapshot is still within retention
- **THEN** Restore reconstructs the data from the CSV snapshot, unaffected by the pruning

### Requirement: Schema documentation (inline annotations)

Documentation SHALL be stored as columns on the entity tables (`bo_at_bases`, `bo_at_tables`, `bo_at_fields`, `bo_at_views`, `bo_at_records`), not a separate table: `ai_description` (AI-generated), `ai_overview` (AI-generated longer summary), and `description_override` (manual). Airtable's own description is already captured as the `description` column (and in `bo_at_schema_versions`) and SHALL NOT be duplicated. The effective description SHALL resolve `description_override ?? ai_description ?? description`. Re-import SHALL write only the `description` column, so AI and manual values are never clobbered. AI generation for sovereign Spaces SHALL use field names/types only (never cell values). The standalone Data Dictionary surface and export are out of scope (V2).

#### Scenario: Re-import preserves AI and manual values

- **WHEN** a field has a `description_override` (or `ai_description`) and a later run re-imports Airtable's description
- **THEN** only the `description` column is updated; `description_override` and `ai_description` are untouched

#### Scenario: Effective description precedence

- **WHEN** a field has both an `ai_description` and a `description_override`
- **THEN** the effective description used by the UI is the `description_override`

### Requirement: Health results in the per-Space DB

Engine-computed health SHALL be stored per-Space: `bo_at_health_scores` (appended per run: 0–100 `score`, `band` Green ≥90 / Yellow 60–89 / Red <60, category breakdown) and `bo_at_health_issues` (replaced per run). The configurable rules SHALL remain in the master-DB `health_score_rules` (Org-scoped).

#### Scenario: Score trend retained, issues current

- **WHEN** consecutive runs compute health
- **THEN** `bo_at_health_scores` accumulates one row per run (trend), while `bo_at_health_issues` reflects only the latest run

### Requirement: Backend migration

The system SHALL support migrating a Space's per-Space DB between backends (`d1` ↔ `managed_pg` ↔ `byodb`) by row-copying all `bo_at_*` tables into a newly provisioned target, keeping the source active until cutover and decommissioning it only after a grace period. A downgrade that exceeds the target's capacity MAY require disabling record storage.

#### Scenario: Upgrade D1 → managed Postgres

- **WHEN** a Space upgrades from `d1` to `managed_pg`
- **THEN** all `bo_at_*` rows are copied into the new Postgres database, reads cut over after verification, and the D1 database is decommissioned after the grace period
</content>
