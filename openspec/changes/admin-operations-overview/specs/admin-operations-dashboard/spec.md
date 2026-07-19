## ADDED Requirements

### Requirement: Operational dashboard at admin home

`apps/admin`'s `/` route SHALL render a read-only operational dashboard summarizing system-wide backup activity across all Organizations, replacing the Organizations → Spaces tracker (which relocates to `/customers` — see `admin-nav-ia`). The dashboard SHALL read only the master DB through the existing Hyperdrive-bound per-request client, SHALL issue no mutating queries, and SHALL be gated by the existing staff middleware.

#### Scenario: Staff opens the dashboard

- **WHEN** a staff user opens `/`
- **THEN** the page renders the active-runs section, KPI tiles, and attention items in a single view without requiring navigation to other pages

#### Scenario: Non-staff is rejected

- **WHEN** a request without a valid staff session hits `/`
- **THEN** the existing gate behavior applies (sign-in redirect or 403) and no operational data is rendered

### Requirement: Active runs section

The dashboard SHALL list backup runs whose status is `queued`, `running`, or `cancelling`, ordered oldest-first by `created_at`, showing for each: Space name and Organization name (both linked to their detail pages), `kind`, `triggered_by`, trial flag, and elapsed time computed from `started_at` (or `created_at` when the run has not started) to page-render time. Restore runs in `queued | running | cancelling` SHALL be listed in the same section, labeled as restores.

#### Scenario: Runs are in flight

- **WHEN** the dashboard renders while at least one backup or restore run is in `queued`, `running`, or `cancelling`
- **THEN** each such run appears with Space, Organization, kind, trigger source, and elapsed time, and the run row links to `/backups/[id]` (or the restore surface for restore runs)

#### Scenario: Nothing is running

- **WHEN** no backup or restore run is active
- **THEN** the section renders an explicit empty state (e.g. "No active runs") rather than an empty table

### Requirement: KPI summary tiles

The dashboard SHALL show 24-hour and 7-day summary tiles derived from `backup_runs.created_at` windows: total runs, succeeded (counting `succeeded`, `trial_complete`, `trial_truncated`), failed, success rate (succeeded ÷ terminal runs, rendered as a percentage), and restore-run count. Windows SHALL be computed from an injected `now: Date` in a pure module so summaries are unit-testable.

#### Scenario: Mixed outcomes in window

- **WHEN** the last 24 hours contain 8 succeeded, 2 failed, and 1 running backup run
- **THEN** the 24h tile reports 11 total, 8 succeeded, 2 failed, and an 80% success rate (running runs excluded from the rate denominator)

#### Scenario: No runs in window

- **WHEN** a window contains zero runs
- **THEN** the tile renders zero counts and an em-dash (no division-by-zero rate)

### Requirement: Attention items

The dashboard SHALL surface four attention groups, each with a count and its most recent items, and each linking onward to the owning surface: (1) overdue schedules — `backup_configurations` rows whose `next_scheduled_at` or `schema_next_scheduled_at` is before now for Spaces with status `active`; (2) Connections needing attention — `connections.status != 'active'`; (3) provisioning errors — `space_databases.status = 'error'`; (4) recent failures — the most recent failed backup runs (at least the last 10) with a truncated `error_message` excerpt. Items SHALL name and link the affected Space and Organization.

#### Scenario: Overdue schedule is surfaced

- **WHEN** an active Space's `backup_configurations.next_scheduled_at` is in the past at render time
- **THEN** the overdue-schedules group counts it and lists the Space (linked) with its Organization and the overdue timestamp

#### Scenario: Recent failure links to drill-in and owner

- **WHEN** a backup run has status `failed`
- **THEN** the recent-failures feed shows the run with an `error_message` excerpt, linking the run to `/backups/[id]` and the Organization to its detail page

#### Scenario: All clear

- **WHEN** all four groups are empty
- **THEN** each group renders an explicit healthy/empty state and the page communicates "nothing needs attention"

### Requirement: Errors deep-dive link degrades gracefully

Attention groups SHALL link to the `/errors` triage surface (owned by change `admin-error-triage`). While `/errors` does not exist in the deployed app, the dashboard SHALL link each group to the existing owning surface instead (`/backups?status=failed`, `/connections`, `/databases`, `/services`) and SHALL NOT render a dead link.

#### Scenario: Errors page absent

- **WHEN** the dashboard renders in a build without an `/errors` route
- **THEN** attention groups link to the existing per-surface pages and no link targets `/errors`

### Requirement: Master-DB-only boundary

The dashboard SHALL read only master-DB operational metadata (statuses, counts, names, timestamps, error messages). It SHALL NOT connect to any per-Space database, SHALL NOT dereference `space_databases` locators, and SHALL NOT select any `*_enc` column. Drill-down depth SHALL bottom out at run/base metadata already exposed by `/backups/[id]`.

#### Scenario: No customer-content access

- **WHEN** any dashboard query executes
- **THEN** it targets only mirrored master-DB tables, and the admin schema mirror used contains no `*_enc` columns and no per-Space DB client is constructed
