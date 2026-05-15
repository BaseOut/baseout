## ADDED Requirements

### Requirement: Dynamic mode runs alongside static

For Spaces with `backup_configurations.mode='dynamic'`, the engine SHALL write to BOTH the static CSV destination AND the per-Space dynamic database. Static-only Spaces SHALL not be affected by this change.

#### Scenario: Dynamic Space backup writes CSV + DB

- **WHEN** a Launch Space with `mode='dynamic'` and `space_databases.status='ready'` runs a backup
- **THEN** the engine SHALL write the CSV to the configured storage destination AND UPSERT records into the dynamic DB's per-table tables

#### Scenario: Static-only Space unaffected

- **WHEN** a Space with `mode='static'` runs a backup
- **THEN** the engine SHALL skip all dynamic-DB writes regardless of whether `space_databases` exists

### Requirement: Provisioning-pending defers dynamic writes

When a dynamic Space starts a run before its `space_databases` row reaches `status='ready'`, the engine SHALL still execute the static CSV path, SHALL log a structured `event: 'dynamic_db_not_ready_skip'`, and SHALL NOT fail the run.

#### Scenario: First backup with pending provisioner

- **WHEN** a Launch Space's `space_databases.status='provisioning'` and a backup run starts
- **THEN** the engine SHALL complete the static write, skip the dynamic write, log the skip event, and mark the run `succeeded`

### Requirement: Schema-only tier skips records

For Spaces with `space_databases.tier='d1_schema_only'`, the engine SHALL write only schema metadata (`_baseout_tables`, `_baseout_fields`) to the dynamic DB. Records SHALL NOT be inserted into per-table tables.

#### Scenario: Trial backup writes schema-only

- **WHEN** a Trial Space (`tier='d1_schema_only'`) runs a backup
- **THEN** the dynamic DB SHALL gain rows in `_baseout_tables` + `_baseout_fields` but no `<table_name>` records tables SHALL be created

### Requirement: Schema diff written to audit log

At the end of each table's schema upsert, the engine SHALL compute the diff against the previous run's schema and SHALL INSERT one row per change into `audit_history` with `event_type='schema_change'`. Diff categories SHALL include `added`, `removed`, `renamed`, and `retyped`.

#### Scenario: Field renamed between runs

- **WHEN** an Airtable field's name changes between two runs while its field ID stays the same
- **THEN** the engine SHALL INSERT one `audit_history` row with `event_type='schema_change'`, `change_type='renamed'`, `old_value=<old name>`, `new_value=<new name>`
