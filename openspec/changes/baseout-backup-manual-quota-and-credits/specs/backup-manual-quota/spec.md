## ADDED Requirements

### Requirement: Tier-gated manual-run quota

The `POST /api/spaces/:spaceId/backup-runs` route SHALL gate manual run creation on the tier's `includedPerPeriod` count per [Features §4.2](../../../shared/Baseout_Features.md). Trial and Starter tiers SHALL receive 403; Launch (2), Growth (5) and Pro+ (unlimited) tiers SHALL allow runs up to the included count without credit charge.

#### Scenario: Trial tier blocked from manual run

- **WHEN** a Trial Space attempts to POST to `/api/spaces/:spaceId/backup-runs`
- **THEN** the route SHALL return 403 `{ error: 'manual_backup_not_available_at_tier' }`

#### Scenario: Launch tier within included count

- **WHEN** a Launch Space POSTs its first or second manual run of the billing period
- **THEN** the route SHALL proceed to `BackupEngineClient.startRun` without checking credit balance

#### Scenario: Launch tier exceeds included count, with credits

- **WHEN** a Launch Space POSTs its third manual run of the period with available credits
- **THEN** the route SHALL proceed to startRun; the per-run completion SHALL charge a 10-credit `backup_manual_trigger` ledger row

### Requirement: Overage policy enforcement

When a run would tip the Org into overage (`total_consumed + cost > total_granted`), the gate SHALL consult the Org's `overage_mode`, `cap_action`, and `overage_dollar_cap_cents` and SHALL block the run only if `overage_mode='cap'` AND `cap_action='pause'` AND the dollar cap would be exceeded.

#### Scenario: overage_mode=auto allows the run

- **WHEN** an Org has `overage_mode='auto'` and a 10-credit run would push usage over `total_granted`
- **THEN** the route SHALL proceed and the credit row SHALL land in `overage_credits` at completion time

#### Scenario: overage_mode=cap, cap_action=pause blocks

- **WHEN** an Org has `overage_mode='cap'`, `cap_action='pause'`, and a run would exceed `overage_dollar_cap_cents`
- **THEN** the route SHALL return 402 `{ error: 'insufficient_credits_capped', creditsNeeded: 10, creditsAvailable: ... }` and SHALL NOT create the run row

#### Scenario: overage_mode=cap, cap_action=notify_only continues

- **WHEN** an Org has `overage_mode='cap'`, `cap_action='notify_only'`, and a run would exceed the cap
- **THEN** the route SHALL proceed; the alert email path SHALL fire separately

### Requirement: Manual-trigger overage fee paid once per run, not per base

The 10-credit `backup_manual_trigger` fee SHALL be charged at most once per `backup_runs` row, regardless of how many bases the run processes. Activity credits (schema, records, attachments) SHALL be charged separately based on per-base counts.

#### Scenario: Manual run over 3 bases beyond quota

- **WHEN** a Launch Space exceeds its included manual count and runs a backup over 3 bases
- **THEN** the ledger SHALL contain exactly one `backup_manual_trigger` row of 10 credits, plus three `backup_schema_metadata` rows (5 each) plus per-base record/attachment rows
