## ADDED Requirements

### Requirement: Daily cron escalates email notifications for dead Connections
`apps/server` SHALL run a daily cron (`0 13 * * *`) that escalates email notifications to Org admins for Connections in `status='pending_reauth'` per the cadence T+24h, T+72h, T+7d, T+14d, T+21d. After T+21d the Connection SHALL transition to `status='invalid'` and SHALL be excluded from future scheduling.

#### Scenario: T+24h initial reminder
- **WHEN** a Connection has been in `'pending_reauth'` for ≥ 24h and < 72h AND no `t+24h` row exists in `notification_log` for that Connection
- **THEN** the cron SHALL POST `/api/internal/orgs/:id/connection-cadence-email` with `{ connectionId, cadenceStep: 't+24h' }`
- **AND** the route SHALL render the T+24h template and dispatch via the Cloudflare Workers `send_email` binding
- **AND** SHALL INSERT into `notification_log` `(kind: 'connection_cadence', sub_kind: 't+24h', connection_id, sent_at: NOW())`

#### Scenario: escalating cadence
- **WHEN** subsequent cron passes find the Connection still in `'pending_reauth'` past the next cadence threshold (72h, 7d, 14d, 21d)
- **THEN** the cron SHALL dispatch the matching step's email exactly once (idempotent on `(connection_id, sub_kind)`)
- **AND** SHALL NOT re-dispatch already-logged steps

#### Scenario: T+21d auto-invalidate
- **WHEN** a Connection has been in `'pending_reauth'` for ≥ 21 days
- **THEN** the cron SHALL dispatch the T+21d email
- **AND** SHALL transition the Connection's `status` to `'invalid'`
- **AND** the SpaceDO scheduler SHALL exclude this Connection from future runs (existing behavior — confirmed by integration test)

#### Scenario: Connection reconnected mid-cadence
- **WHEN** a customer reconnects the source and the Connection flips back to `'active'` between cron passes
- **THEN** the next cron pass SHALL find no eligible row for that Connection
- **AND** SHALL NOT dispatch any further cadence emails
- **AND** the `notification_log` rows from prior steps SHALL remain (historical record; the cadence is one-shot per pending_reauth episode)

### Requirement: Cron is bounded by Worker wall clock
The dead-connection cadence pass SHALL complete inside a single Cloudflare Worker request (no Trigger.dev task). The work is bounded: at most one email-trigger per Org with a dead Connection per day.

#### Scenario: pass completes within budget
- **WHEN** the cron fires
- **THEN** the pass SHALL complete in under 30 seconds for any reasonable customer-base size (≤ 10K Orgs)
- **AND** SHALL emit `event: 'connection_cadence_pass_complete'` with the count of emails dispatched
