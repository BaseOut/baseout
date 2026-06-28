## ADDED Requirements

### Requirement: backup-base is kind-aware

The `backup-base` task payload SHALL include `kind` (`schema` | `data`), and the pure orchestration SHALL branch on it. A payload without `kind` SHALL default to `data` (preserving pre-rollout behavior).

#### Scenario: Kind threaded from the engine

- **WHEN** the engine enqueues `backup-base` with `kind = 'schema'`
- **THEN** the task runs the schema-only flow and tags the run accordingly

#### Scenario: Missing kind defaults to data

- **WHEN** a `backup-base` payload omits `kind`
- **THEN** the task runs the full schema+data flow (back-compatible default)

### Requirement: Shared schema-capture step

Schema capture SHALL be a single reusable step — fetch the base schema, diff against current, upsert `bo_at_bases/tables/fields/views` + lifecycle, write `bo_at_schema_updates`, and create or look up the hash-deduped `bo_at_schema_versions`. Both run kinds SHALL use it; a `data` run SHALL run it **before** capturing records.

#### Scenario: Data run captures schema first

- **WHEN** a `data`-kind run executes
- **THEN** it runs the shared schema-capture step first (producing/refreshing a `bo_at_schema_versions` entry) and only then captures records

### Requirement: Schema run captures schema only

For `kind = 'schema'`, the task SHALL run the schema-capture step and stop: it SHALL NOT fetch records, SHALL NOT upsert record tables, and SHALL NOT write the per-run data CSV. It SHALL set `bo_at_base_runs.kind = 'schema'`.

#### Scenario: No record work on a schema run

- **WHEN** a `schema`-kind run completes
- **THEN** schema tables/versions/updates are written, no records or data CSV are produced, and the run is tagged `kind = 'schema'`

### Requirement: Data run captures schema then records

For `kind = 'data'`, the task SHALL run the schema-capture step, then the records path (CSV stream to the file destination and/or dynamic-DB upserts) and the per-run CSV snapshot, and SHALL set `bo_at_base_runs.kind = 'data'`.

#### Scenario: Full capture on a data run

- **WHEN** a `data`-kind run completes
- **THEN** schema is captured, records are written per the configured destination(s), the per-run CSV snapshot is produced, and the run is tagged `kind = 'data'`

### Requirement: Overlapping runs are safe

The task SHALL NOT assume exclusivity between a `schema` run and a `data` run for the same Space/base. Serialization of Airtable access SHALL rely on the per-Connection lock, and schema writes SHALL be idempotent (ID-keyed upserts + hash-deduped `bo_at_schema_versions`) so a redundant or overlapping schema capture converges to a no-op.

#### Scenario: Schema run overlaps a data run

- **WHEN** a `schema` run and a `data` run for the same base execute close together
- **THEN** schema writes from whichever runs second dedupe to a no-op (no duplicate version, no corruption), and neither run fails due to the other

### Requirement: Run kind in the callback contract

Progress and completion engine-callbacks SHALL include `kind`. A `schema` run's progress SHALL report schema metrics (tables/fields), not record counts.

#### Scenario: Schema progress callback

- **WHEN** a `schema` run reports progress
- **THEN** the callback carries `kind = 'schema'` and schema metrics, and the engine rolls `kind` up to the master `backup_runs` row
</content>
