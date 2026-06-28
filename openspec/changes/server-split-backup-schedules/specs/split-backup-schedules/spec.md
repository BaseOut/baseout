## ADDED Requirements

### Requirement: Two independent backup schedules per Space

A backup configuration SHALL carry two independent schedules: a **schema** schedule (`schema_frequency`) and a **data** schedule (`data_frequency`), each one of `monthly | weekly | daily | instant`, with `data_frequency` additionally allowing `NULL`. `data_frequency = NULL` SHALL mean the Space is **Schema Only**. Each schedule SHALL have its own next-fire timestamp (`schema_next_scheduled_at`, `data_next_scheduled_at`).

#### Scenario: Schema daily, data monthly

- **WHEN** a Space sets `schema_frequency = daily` and `data_frequency = monthly`
- **THEN** schema-only runs fire daily and full data runs fire monthly, each tracked by its own next-fire timestamp

#### Scenario: Schema Only Space

- **WHEN** a Space sets `data_frequency = NULL`
- **THEN** only schema runs are scheduled; no data run is ever scheduled and no records are captured

### Requirement: Backup scope determines record capture

Backup scope SHALL be derived from the presence of a data schedule: `data_frequency != NULL` ⇒ **Schema + Data** (records are captured; provisioning sets `space_databases.records_enabled = true`); `data_frequency = NULL` ⇒ **Schema Only** (`records_enabled = false`; no record tables populated and no per-run data CSV written). `mode` (static files vs dynamic DB) SHALL remain orthogonal and apply only to Schema + Data.

#### Scenario: Switching a Space to Schema Only

- **WHEN** a Space's `data_frequency` is cleared to `NULL`
- **THEN** its scope becomes Schema Only, `records_enabled` is set false, and subsequent runs capture schema but no records

### Requirement: Typed runs (schema vs data)

Each run SHALL have a `kind` of `schema` or `data`, recorded on both the master `backup_runs` row and the per-Space `bo_at_base_runs` rows. A `schema` run SHALL capture only schema (the per-Space schema tables, `bo_at_schema_versions`, `bo_at_schema_updates`). A `data` run SHALL capture schema **first** and then records, and SHALL write the full per-run CSV snapshot.

#### Scenario: Schema run captures no records

- **WHEN** a `schema`-kind run executes
- **THEN** it upserts schema + lifecycle + diffs/versions, writes no records and no data CSV, and the run/history shows `kind = schema`

#### Scenario: Data run always captures schema first

- **WHEN** a `data`-kind run executes
- **THEN** it captures the current schema (producing/refreshing a `bo_at_schema_versions` entry) before capturing records, so records are never stored without a matching schema snapshot

### Requirement: SpaceDO multiplexes both schedules onto one alarm

The per-Space scheduler SHALL compute the next fire for each schedule and arm its single alarm to the earliest of the two. On fire it SHALL resolve which schedule(s) are due within a defined tolerance window; if the **data** schedule is due it SHALL run a `data` run (which subsumes a coincident `schema` due-time — no separate schema run is also dispatched), otherwise it SHALL run a `schema` run. It SHALL then update both next-fire timestamps and re-arm the alarm. The schedule-update entry point SHALL accept both frequencies (`POST /set-schedules`).

#### Scenario: Coincident schema and data fires

- **WHEN** the schema and data schedules are both due in the same tolerance window
- **THEN** a single `data` run is dispatched (it captures schema too) and no separate `schema` run is dispatched for that tick

#### Scenario: Re-arm after a fire

- **WHEN** a scheduled run is dispatched
- **THEN** the SpaceDO recomputes both next-fire timestamps and arms the alarm to the earliest upcoming fire

### Requirement: Configuration migration from a single frequency

The migration from the single-`frequency` model SHALL preserve each Space's current cadence and record behavior. A Space that currently captures records SHALL get `data_frequency = frequency` and `schema_frequency = frequency`; a Space that is currently schema-only SHALL get `data_frequency = NULL` and `schema_frequency = frequency`. The legacy `frequency` / `next_scheduled_at` SHALL be removed after migration.

#### Scenario: Existing record-capturing Space migrates without behavior change

- **WHEN** a Space with `frequency = weekly` that captures records is migrated
- **THEN** it gets `schema_frequency = weekly` and `data_frequency = weekly`, and its observable backup cadence and record capture are unchanged

### Requirement: Per-schedule tier gating

Each frequency SHALL be validated independently against the Org tier using the existing frequency tier rules (Monthly all tiers, Weekly Launch+, Daily Pro+, Instant Pro+). Schema Only SHALL be available broadly so a customer can use the Schema page without committing to data backups; a higher-frequency or separate schema schedule beyond the data cadence MAY be tier-gated.

#### Scenario: Daily schema schedule rejected below Pro

- **WHEN** a non-Pro+ Space requests `schema_frequency = daily`
- **THEN** the config update is rejected with a tier error, the same way a daily data frequency would be
</content>
