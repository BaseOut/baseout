## ADDED Requirements

### Requirement: One-shot entry point

The migration script SHALL live in `baseout-server` as a one-shot entry point under `src/migration/` (or equivalent) — manually invoked, not on a cron schedule, and not exposed as a public route.

#### Scenario: Manual invocation

- **WHEN** an operator triggers the migration via admin tooling (or `wrangler tail`-monitored direct invocation)
- **THEN** the script executes once and reports completion or failure

### Requirement: Read and tier mapping

The script SHALL read all On2Air customer records from the legacy DB and SHALL map each to a Baseout tier per the rules in `../shared/Pricing_Credit_System.md` §5.

#### Scenario: Legacy "Pro" customer mapping

- **WHEN** an On2Air "Pro" customer record is read
- **THEN** the customer is mapped to the corresponding Baseout tier per the documented mapping rules

### Requirement: Org and Stripe creation

For each mapped customer the script SHALL create a Baseout `organizations` row, a Stripe customer + subscription, and `subscription_items` populated with the mapped tier. It SHALL set `organizations.dynamic_locked=true` and `has_migrated=false` until the user completes the migration UX.

#### Scenario: Stripe subscription created

- **WHEN** an Org is created from a legacy customer
- **THEN** the corresponding Stripe customer and subscription exist with the mapped subscription items, and the Org has `dynamic_locked=true` and `has_migrated=false`

### Requirement: Re-encryption under AES-256-GCM

For any persisted backup metadata or secrets, the script SHALL decrypt with the legacy keys and re-encrypt under AES-256-GCM using the new master key.

#### Scenario: Re-encrypted token

- **WHEN** a legacy-encrypted Airtable token is migrated
- **THEN** the script decrypts it, encrypts under AES-256-GCM, and writes to the new column

### Requirement: Migration credit grant

The script SHALL grant migration credits per `../shared/Pricing_Credit_System.md` §6 — 2K (Bridge), 10K (Starter), 30K (Launch), 80K (Growth) — written as `credit_buckets` of type `manual_grant` or as documented in the credit system spec.

#### Scenario: Bridge customer grant

- **WHEN** a customer is mapped to the Bridge tier
- **THEN** a 2,000-credit bucket is created with `granted_for='migration'`

### Requirement: Dry-run mode

The script SHALL support a `--dry-run` flag that performs all read and mapping steps without writing to the master DB or Stripe.

#### Scenario: Dry-run completes without writes

- **WHEN** the script runs with `--dry-run`
- **THEN** no `organizations`, Stripe, or credit rows are created, and the script outputs the planned changes

### Requirement: Idempotent re-run

Re-running the script SHALL be safe — processed customer rows SHALL be tracked and skipped on subsequent runs.

#### Scenario: Re-run after partial failure

- **WHEN** the script crashes after migrating 60% of customers and is re-run
- **THEN** the previously migrated 60% are skipped and only the remaining 40% are processed

### Requirement: Sanity checks and review queue

The script SHALL run sanity checks after each customer migration and SHALL place failures in a manual review queue for operator follow-up.

#### Scenario: Decrypt failure

- **WHEN** a legacy token cannot be decrypted with any known key
- **THEN** that customer is added to the manual review queue rather than failing the whole script
