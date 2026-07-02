## ADDED Requirements

### Requirement: Backup scope selector

The backup-config surface SHALL present a scope selector — **Schema Only** and **Schema + Data** — that reshapes the schedule controls. Schema Only SHALL be selectable on all tiers and SHALL make clear that record data is not backed up.

#### Scenario: Choosing Schema Only

- **WHEN** the user selects **Schema Only**
- **THEN** the data cadence control is hidden, only the schema cadence remains, and copy communicates that record data is not being backed up

#### Scenario: Choosing Schema + Data

- **WHEN** the user selects **Schema + Data**
- **THEN** both a data cadence and a schema cadence control are shown

### Requirement: Scope-aware schedule controls

When scope is **Schema + Data**, the UI SHALL show a **Data backup** cadence and a **Schema backup** cadence with an inline note that every data backup also captures schema and that schema may run more frequently. When scope is **Schema Only**, the UI SHALL show a single **Schema backup** cadence. The UI SHALL surface a non-blocking hint when schema is set less frequently than data (redundant) without blocking it.

#### Scenario: Schema more frequent than data

- **WHEN** the user sets Data = monthly and Schema = daily
- **THEN** both controls accept the values and the note explains schema refreshes daily while a full backup runs monthly

#### Scenario: Schema less frequent than data is discouraged

- **WHEN** the user sets schema less frequently than data
- **THEN** a non-blocking hint notes the schema schedule is redundant

### Requirement: Per-cadence tier gating

Each cadence option SHALL be gated by tier independently (Monthly all · Weekly Launch+ · Daily/Instant Pro+) via the existing upgrade affordance, applied equally to the schema and data pickers. The Schema Only scope SHALL never be tier-gated.

#### Scenario: Daily locked below Pro

- **WHEN** a non-Pro+ user opens either cadence picker
- **THEN** the Daily option appears as an upgrade affordance, not a dead control

### Requirement: Per-schedule next-run display

The UI SHALL show the next scheduled run for each active schedule — "Next data backup" and "Next schema backup" — each handling the not-yet-scheduled state. A Schema Only Space SHALL show only the schema next-run line.

#### Scenario: Both schedules active

- **WHEN** a Space has both schedules
- **THEN** the surface shows both "Next data backup: …" and "Next schema backup: …"

### Requirement: Run kind in backup history

Backup history rows SHALL display the run kind — **Schema** vs **Full** — as a secondary badge alongside the status, read from `backup_runs.kind`.

#### Scenario: Mixed history

- **WHEN** a Space runs daily schema backups and monthly full backups
- **THEN** each history row shows a Schema or Full badge in addition to its status
