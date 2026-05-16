## ADDED Requirements

### Requirement: Operations metered by backup

The `server` repo SHALL write `credit_transactions` rows for the following operations: schema/metadata backup (5 per base per run), record data transfer (1 per 1,000 records), attachment data transfer (1 per 50 MB), restore — table (15 per excess), restore — base records (40 per excess), restore — base records + attachments (75 per excess), smart cleanup manual trigger (10 per), SQL REST query (1 per 50 queries), and AI schema insight (5 per — V2).

#### Scenario: Record data transfer rounding

- **WHEN** a backup transfers 2,300 records
- **THEN** 3 credits are debited (rounded up to the next 1,000)

#### Scenario: Manual smart cleanup

- **WHEN** a user manually triggers smart cleanup
- **THEN** a `credit_transactions` row debits 10 credits with `trigger_type='manual'`

### Requirement: Bucket priority order

Credit consumption SHALL debit from active buckets in this priority order: onboarding → plan_monthly → addon_monthly → promotional → purchased → manual_grant. Within priority, expiration ascending.

#### Scenario: Onboarding before plan_monthly

- **WHEN** an Org has both onboarding and plan_monthly buckets active
- **THEN** the onboarding bucket is debited first

### Requirement: Mid-run overage cap pause

When a long-running backup crosses the dollar overage cap mid-run AND the Org's `overage_mode='cap'`, the engine SHALL pause the run (`backup_runs.status='paused'`), notify the user (raise the cap, buy credits, or upgrade), and resume only after one of those actions clears the block.

#### Scenario: Cap reached mid-run

- **WHEN** a multi-base backup crosses the cap on its third base
- **THEN** the run pauses, in-flight Trigger.dev jobs complete cleanly, and `status='paused'` is set with a notification dispatched

### Requirement: Refusal at cap before start

When `overage_mode='cap'` and the cap would be reached at run start, the engine SHALL refuse the operation rather than start a partial run.

#### Scenario: Pre-run cap check

- **WHEN** an Org with `overage_mode='cap'` and exhausted buckets attempts a new backup
- **THEN** the run is refused at the start gate with a structured cap-reached error

### Requirement: Balance cache update

After every transaction, the engine SHALL update the `organization_credit_balance` cache so reads stay fast.

#### Scenario: Cache stays consistent

- **WHEN** a debit transaction commits
- **THEN** `organization_credit_balance` is updated within the same transaction or via an immediate follow-up write

### Requirement: Stripe metered usage reporting

The `server` repo SHALL report period-close metered usage to Stripe directly via the Stripe API (no `web` coordination), so cross-repo period boundaries do not require synchronization.

#### Scenario: Period close

- **WHEN** a billing period closes for an Org
- **THEN** `server` reads the period's overage transactions, calls Stripe's `customer.subscription.report_usage`, and marks the period reported
