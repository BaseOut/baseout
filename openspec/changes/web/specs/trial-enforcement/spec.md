## ADDED Requirements

### Requirement: Trial duration

A Trial SHALL last 7 days OR until 1 successful backup run completes, whichever comes first.

#### Scenario: 1 successful run before day 7

- **WHEN** a Trial user completes their first successful backup run on day 3
- **THEN** the trial converts to paid (or expires) without waiting for day 7

#### Scenario: 7 days without a successful run

- **WHEN** a Trial user reaches day 7 without a successful run
- **THEN** the trial expires per the trial-expiry monitor

### Requirement: Trial data caps

A Trial run SHALL stop at 1,000 records, 5 tables, or 100 attachments — whichever cap is hit first. Cap enforcement SHALL be performed at run time by the `server`'s backup engine.

#### Scenario: 5-table cap

- **WHEN** a Trial run reaches a 5th table during execution
- **THEN** the run stops and `backup_runs.status='trial_complete'` is set

### Requirement: Trial scope

A Trial SHALL be scoped per platform, per Organization, ever. The same platform SHALL NOT be retried after the trial converts or expires.

#### Scenario: Re-trial blocked

- **WHEN** an Org with `trial_ever_used=true` for Airtable attempts to start a new Airtable trial
- **THEN** the request is refused

### Requirement: Trial state flags

Trial state SHALL be tracked on `subscription_items` with `trial_ends_at`, `trial_backup_run_used`, and `trial_ever_used`.

#### Scenario: First-run uses up trial

- **WHEN** a Trial user's first run hits a cap and is marked `trial_complete`
- **THEN** `subscription_items.trial_backup_run_used=true` and `trial_ever_used=true`

### Requirement: Day-7 detection lives in back

The Day-5 / Day-7 trial expiry detection cron SHALL live in `server` (per the `server` specs). `web` SHALL NOT run trial-expiry detection but SHALL accept the `server`-generated state and surface it on the dashboard.

#### Scenario: Day-7 conversion

- **WHEN** `server` converts a trial to paid on day 7 via Stripe
- **THEN** the `web` repo capability resolver returns the new tier on next refresh
