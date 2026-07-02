## ADDED Requirements

### Requirement: Per-Space backup scope and schema schedule

`backup_configurations` SHALL carry a `scope` of `schema_only` or `schema_and_data`, and an optional `schema_frequency` cadence with an engine-owned `schema_next_scheduled_at`. The existing `frequency`/`next_scheduled_at` are the **data** schedule. When `scope='schema_only'`, no data backup runs; when `scope='schema_and_data'`, the data schedule runs and, if `schema_frequency` is set, an additional schema schedule runs. Existing rows SHALL default to `scope='schema_and_data'` with no separate schema schedule, preserving current behavior.

#### Scenario: Schema-only Space runs no data backup

- **WHEN** a Space has `scope='schema_only'` and `schema_frequency='daily'`
- **THEN** only schema runs are scheduled and no `full` run is dispatched

#### Scenario: Dual schedule

- **WHEN** a Space has `scope='schema_and_data'`, `frequency='monthly'`, and `schema_frequency='daily'`
- **THEN** a `full` run is scheduled monthly and a `schema` run daily

### Requirement: Per-run kind

`backup_runs` SHALL carry a `kind` of `full` or `schema` (default `full`). Manual runs and data-scheduled runs SHALL be `full`; schema-scheduled runs SHALL be `schema`. The `kind` SHALL be passed to the per-base task payload.

#### Scenario: Schema-scheduled run is kind=schema

- **WHEN** the schema schedule fires
- **THEN** the inserted `backup_runs` row has `kind='schema'` and the task payload carries `kind='schema'`

### Requirement: SpaceDO multiplexes two cadences

`SpaceDO` SHALL dispatch both the data and schema schedules from its single alarm: it SHALL fire every schedule whose next-fire is due (including both at a shared boundary), insert a run per fired kind, recompute the fired schedule(s)' next-fire, and re-arm the alarm for the nearer remaining next-fire. The `instant` cadence SHALL remain out of scope for both schedules.

#### Scenario: Both schedules due at the same boundary

- **WHEN** the data and schema next-fires both fall at the same alarm tick
- **THEN** both a `full` and a `schema` run are inserted, and the alarm re-arms for whichever next-fire is nearer

#### Scenario: Re-arm picks the nearer next-fire

- **WHEN** only the schema schedule is due
- **THEN** a `schema` run is inserted, the schema next-fire advances, and the alarm re-arms for `min(dataNextFire, schemaNextFire)`

### Requirement: Scope-aware set-schedule

The engine SHALL expose an `INTERNAL_TOKEN`-gated route that accepts `{ scope, dataFrequency?, schemaFrequency? }`, computes both next-fires, writes `next_scheduled_at` and `schema_next_scheduled_at`, and seeds the SpaceDO. A legacy `{ frequency }` body SHALL be accepted as `{ scope:'schema_and_data', dataFrequency:frequency }`.

#### Scenario: Set a dual schedule

- **WHEN** `POST set-schedule` with `{ scope:'schema_and_data', dataFrequency:'monthly', schemaFrequency:'daily' }`
- **THEN** both `next_scheduled_at` and `schema_next_scheduled_at` are written and the DO is armed for the nearer fire

#### Scenario: Legacy single-frequency body

- **WHEN** `POST set-schedule` with `{ frequency:'weekly' }`
- **THEN** it is treated as `scope='schema_and_data'`, `dataFrequency='weekly'`, no separate schema schedule
