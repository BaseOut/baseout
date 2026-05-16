## ADDED Requirements

### Requirement: 15-minute cron audits stale per-Connection locks
`apps/server` SHALL run a 15-minute cron (`*/15 * * * *`) that audits each `ConnectionDO` known to potentially hold a lock, requesting the DO release any lock held longer than `LOCK_MAX_AGE_MS` (30 minutes).

#### Scenario: no live runs
- **WHEN** the cron fires and no `backup_runs` row has `status='running'`
- **THEN** the cron SHALL no-op without contacting any DO
- **AND** SHALL emit `event: 'connection_lock_audit_no_eligible_dos'`

#### Scenario: fresh lock retained
- **WHEN** a ConnectionDO holds a lock for less than `LOCK_MAX_AGE_MS`
- **THEN** the audit endpoint SHALL respond `{ heldFor: <ms> }`
- **AND** SHALL NOT release the lock

#### Scenario: stale lock released
- **WHEN** a ConnectionDO holds a lock for ≥ `LOCK_MAX_AGE_MS` (default 30 minutes)
- **THEN** the audit endpoint SHALL respond `{ heldFor: <ms> }` AND delete the lock as a side-effect
- **AND** SHALL emit a structured log line `event: 'connection_lock_released_by_audit'`

#### Scenario: audit-endpoint failure is non-fatal
- **WHEN** the audit POST returns 5xx or a network error for a specific DO
- **THEN** the pass SHALL swallow the error and continue to the next DO
- **AND** SHALL emit `event: 'connection_lock_audit_failed'` with the connection ID
- **AND** the next 15-minute cron pass SHALL retry that DO

### Requirement: Audit endpoint is INTERNAL_TOKEN-gated and idempotent
The new `POST /api/internal/connections/:id/lock/audit` endpoint SHALL require the `x-internal-token` header and SHALL be idempotent (repeated calls produce no further side effects beyond the first releasing call).

#### Scenario: missing token rejected
- **WHEN** a request to the audit endpoint omits or supplies a wrong `x-internal-token`
- **THEN** the endpoint SHALL return HTTP 401

#### Scenario: idempotency after release
- **WHEN** the audit endpoint releases a stale lock
- **AND** a follow-up audit fires within the same pass
- **THEN** the second call SHALL return `{ heldFor: null }` and SHALL be a no-op
