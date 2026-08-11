## ADDED Requirements

### Requirement: Manual-run gate

`POST /api/spaces/:spaceId/backup-runs` SHALL consult `resolveTrialState(orgId)` before INSERTing the `backup_runs` row. The route SHALL return 402 when the trial state blocks the run.

#### Scenario: Active trial, run already used

- **WHEN** an Org's trial is `phase='active'` with `runUsed=true` and the user POSTs to start a backup
- **THEN** the route SHALL return 402 `{ error: 'trial_run_used', upgradeUrl: '/billing/upgrade' }` and SHALL NOT INSERT the run row

#### Scenario: Expired trial, no conversion

- **WHEN** an Org's trial is `phase='expired_no_conversion'` and the user POSTs to start a backup
- **THEN** the route SHALL return 402 `{ error: 'trial_expired_upgrade_required', expiredAt }` and SHALL NOT INSERT the run row

#### Scenario: Converted Org runs unimpeded

- **WHEN** an Org's `trial_converted_at` is set and `is_trial` is false
- **THEN** the gate SHALL be a no-op and the run SHALL proceed to the standard manual-quota gate

### Requirement: Frequency-PATCH gate

`PATCH /api/spaces/:spaceId/backup-config` SHALL reject `frequency` values outside `['monthly']` for any Space whose Org's trial is `phase='active' | 'expired_no_conversion'`.

#### Scenario: Trial Space tries daily

- **WHEN** a Trial Space PATCHes `frequency='daily'`
- **THEN** the route SHALL return 400 `{ error: 'frequency_not_available_at_tier', allowed: ['monthly'] }`

### Requirement: Scheduled-fire gate

The SpaceDO alarm-fire path SHALL consult `resolveTrialState` before INSERTing a `backup_runs` row with `triggered_by='scheduled'`. If the trial state blocks runs, the alarm SHALL log a structured skip event and SHALL NOT proceed.

#### Scenario: Scheduled fire when run-used

- **WHEN** the SpaceDO's cron alarm fires for a Trial Space whose `trial_backup_run_used=true`
- **THEN** the alarm SHALL log `event: 'trial_scheduled_run_skipped_run_used'` with `{ spaceId, orgId }` and SHALL NOT INSERT a run row

#### Scenario: Scheduled fire when expired

- **WHEN** the SpaceDO's cron alarm fires for a Trial Space past `trial_ends_at`
- **THEN** the alarm SHALL log `event: 'trial_scheduled_run_skipped_expired'` and SHALL NOT INSERT a run row

### Requirement: Engine flips run-used flag on trial-terminal status

The engine's `/runs/complete` route SHALL, on receiving `status='trial_complete'` or `status='trial_truncated'`, UPDATE `subscription_items.trial_backup_run_used=true` for the Org's active trial subscription item.

#### Scenario: Cap-hit run flips the flag

- **WHEN** a Trial run hits the 1000-record cap and the engine reports `status='trial_complete'` via `/runs/complete`
- **THEN** the complete-handler SHALL UPDATE `subscription_items.trial_backup_run_used=true` for the Org's trial row AND SHALL log `event: 'trial_run_used_flipped'`

### Requirement: Stripe conversion clears the gate

The Stripe `customer.subscription.updated` webhook handler SHALL, on detecting a trial → paid transition, UPDATE `subscription_items.is_trial=false`, `trial_converted_at=now()`, and `trial_backup_run_used=false`. The user's subsequent runs SHALL be unblocked.

#### Scenario: Trial customer upgrades to Launch

- **WHEN** the Stripe webhook fires with `customer.subscription.updated` and the new price is a paid tier (e.g. Launch)
- **THEN** the handler SHALL set `is_trial=false`, `trial_converted_at=now()`, `trial_backup_run_used=false` on the affected `subscription_items` row
