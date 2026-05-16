## ADDED Requirements

### Requirement: Provisioning task invokes the dispatcher with retry
A Trigger.dev task `provision-space-database` SHALL invoke the server-side per-tier provisioning dispatcher (D1 / Shared PG / Dedicated PG / BYODB) on behalf of a Space.

#### Scenario: provision happy path
- **WHEN** the task is triggered with `{ spaceId, tier }`
- **THEN** it SHALL POST `/api/internal/spaces/:spaceId/provision-database` with `{ tier }` + `x-internal-token`
- **AND** SHALL retry transient failures (5xx, network resets) up to 3 attempts with exponential backoff
- **AND** SHALL surface a final `{ status: 'provisioned' }` on success

#### Scenario: dispatcher idempotency
- **WHEN** the task is re-triggered against a Space whose `space_databases.status` is already `'ready'`
- **THEN** the dispatcher SHALL no-op
- **AND** the task SHALL return `{ status: 'provisioned' }` without re-running migrations

### Requirement: backup-base writes per-table schema diff
The backup-base task SHALL compute a schema diff vs the previous run's stored schema at each table boundary and POST an `audit_history` row.

#### Scenario: diff emitted per table
- **WHEN** a table's records finish backing up
- **THEN** the task SHALL fetch the previous run's schema for that table via engine-callback
- **AND** SHALL compute added / removed / renamed / retyped field deltas
- **AND** SHALL POST the delta to `/api/internal/runs/:runId/audit-history` with the table identifier
- **AND** SHALL continue to the next table on success (POST is fire-and-forget)
