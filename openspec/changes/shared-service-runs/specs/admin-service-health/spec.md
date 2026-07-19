# admin-service-health

## ADDED Requirements

### Requirement: Admin mirrors service_runs read-only
`apps/admin/src/db/schema/core.ts` SHALL gain a partial mirror of `service_runs` following the established mirror rules: header comment naming the canonical source (web schema + migration), selected columns only, no FK `.references()`. Admin SHALL only SELECT from the mirror — no INSERT/UPDATE/DELETE call sites (guard-tested like the audit-log discipline).

#### Scenario: Mirror stays read-only
- **WHEN** the admin test suite runs its write-surface guard
- **THEN** no code path in `apps/admin` performs INSERT, UPDATE, or DELETE against `service_runs`

### Requirement: /services shows real per-service run history
The admin `/services` page SHALL render, for every identifier in the service registry: the latest run's status and time, the most recent successful run's time, the current consecutive-failure streak, and recent run durations. Registry services with no rows yet SHALL be shown as "no runs recorded" (distinguishing reserved/not-yet-built services from silently dead ones by labeling reserved identifiers as not yet implemented).

#### Scenario: Healthy service summary
- **WHEN** a service's latest runs are `succeeded`
- **THEN** its card/row shows a success badge, last-run and last-success times, and zero failure streak

#### Scenario: Failing service surfaces its streak
- **WHEN** a service's latest N runs are `failed`
- **THEN** its card/row shows a failure badge, the streak count, and the latest `error_message`

#### Scenario: Reserved service not yet built
- **WHEN** a registry identifier has no `service_runs` rows and is marked reserved
- **THEN** it renders as "not yet implemented" rather than as a health warning

### Requirement: Stuck runs render as warnings
A run still in `status = 'started'` past its service's staleness window (a per-service constant in the admin view logic, defaulting to 4× the service's expected cadence) SHALL render as a warning ("possibly crashed / never finalized"), not as currently running.

#### Scenario: Dangling started row
- **WHEN** a `started` row's `started_at` is older than the service's staleness window with no finalize
- **THEN** the service shows a warning state naming the dangling run's start time

### Requirement: Recent failures are listed with errors
The page SHALL list recent `failed` runs across all services (most recent first, bounded count) with service, start time, duration, and `error_message`, so staff can triage without querying the DB.

#### Scenario: Failure appears in the list
- **WHEN** any service run finalizes as `failed`
- **THEN** it appears at the top of the recent-failures list with its error message

### Requirement: Signals without a writer stay derived and labeled
Services that do not yet write `service_runs` (SpaceDO backup scheduler; connection-session sweep until `server-cron-connection-lock-manager` lands) SHALL keep their existing derived signals (overdue `next_scheduled_at` counts, stale `connection_sessions` counts), each explicitly labeled as derived from data side-effects. The stale "scheduled() is a stub" comment in `apps/admin/src/lib/service-health.ts` SHALL be corrected to describe the current cron dispatch.

#### Scenario: Derived signal remains honest
- **WHEN** the scheduler has overdue `backup_configurations.next_scheduled_at` rows
- **THEN** the scheduler signal shows a warning and is labeled as derived, unchanged from today's behavior
