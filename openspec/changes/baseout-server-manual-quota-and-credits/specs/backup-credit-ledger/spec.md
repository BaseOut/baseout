## ADDED Requirements

### Requirement: Append-only credit ledger

A `credit_ledger` table SHALL record every credit transaction (debit or credit) as an immutable row. The application layer SHALL NOT issue UPDATE or DELETE statements against `credit_ledger`. Reversals SHALL be expressed as compensating INSERTs.

#### Scenario: Successful backup run writes ledger rows

- **WHEN** a backup run completes successfully with `recordCount=12500`, `attachmentBytes=120MB`, `basesProcessed=3`, `triggerSource='manual'` and within quota
- **THEN** the ledger SHALL contain three new rows: `backup_schema_metadata` (15 credits = 3 × 5), `backup_record_transfer` (13 credits = ceil(12500/1000) × 1), `backup_attachment_transfer` (3 credits = ceil(120/50) × 1), and `backup_runs.credits_charged` SHALL be 31

#### Scenario: Manual run beyond included count adds trigger fee

- **WHEN** a Launch Space's third manual run of the period completes (after 2 included runs)
- **THEN** the ledger SHALL contain a `backup_manual_trigger` row for 10 credits in addition to the activity rows

### Requirement: Atomic per-run credit insertion

All credit-ledger rows + the `credit_balances` UPSERT + the `backup_runs.credits_charged` UPDATE for a single run completion SHALL happen inside one Postgres transaction. Partial failure SHALL roll back every credit change for that run.

#### Scenario: Balance UPSERT fails mid-transaction

- **WHEN** the engine reports a run completion but the `credit_balances` UPSERT raises a serialization error
- **THEN** no ledger rows from this run SHALL be persisted; `backup_runs.credits_charged` SHALL remain 0; the route SHALL return the underlying error so the engine can retry the callback

### Requirement: Per-period balance tracking

A `credit_balances` row SHALL exist per (`organization_id`, `billing_period_start`) and SHALL be updated incrementally on every debit. `total_consumed` SHALL never decrement; any returned credits SHALL be expressed as a compensating ledger row plus an increase to `total_granted`.

#### Scenario: Period rollover creates new balance row

- **WHEN** the Stripe `invoice.created` webhook advances an Org's `current_period_start`
- **THEN** a new `credit_balances` row SHALL be created for the new period with `total_granted` = plan credits + add-on credits, `total_consumed=0`, `overage_credits=0`

#### Scenario: Overage tips into `overage_credits`

- **WHEN** an Org with `total_granted=1000` and `total_consumed=995` records a 10-credit debit
- **THEN** `total_consumed` SHALL become 1005 (continues monotonic) and `overage_credits` SHALL become 5 (the portion beyond grant)
