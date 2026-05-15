## ADDED Requirements

### Requirement: Credit-balance-alerts daily cron
A Trigger.dev scheduled task `credit-balance-alerts` SHALL run once daily, compare each Org's prior-day and current-day `total_consumed / total_granted` ratios, and POST a trigger event per threshold (50 / 75 / 90 / 100%) crossing.

#### Scenario: alert at threshold crossing
- **WHEN** an Org's ratio crosses from below to at-or-above a threshold (50 / 75 / 90 / 100%) between yesterday's and today's snapshot
- **THEN** the task SHALL POST `/api/internal/orgs/:id/credit-alert` with `{ threshold, ratio }` + `x-internal-token`
- **AND** the server side SHALL render + dispatch the Mailgun email
- **AND** the task SHALL emit `event: 'credit_alert_dispatched'` per send

#### Scenario: no-flip case
- **WHEN** an Org's ratio is unchanged or stays in the same bucket between snapshots
- **THEN** the task SHALL NOT POST a credit-alert event for that Org

### Requirement: backup-base completion payload carries attachment bytes
The backup-base task wrapper SHALL include `attachmentBytesByBase` in the per-base completion payload so the engine's credit-charge path can bill for storage-byte volume.

#### Scenario: bytes posted on completion
- **WHEN** a backup-base run completes
- **THEN** the wrapper's `/api/internal/runs/:runId/complete` POST SHALL include `attachmentBytesByBase: { [baseId]: number }` (zeros if attachments are off or no attachment fields exist)
