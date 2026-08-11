## ADDED Requirements

### Requirement: Restore trigger and scope

Restores SHALL be triggered by `web` writing a `restore_runs` row with `status='pending'` and POSTing `/restores/{id}/start` with a valid service token. The engine SHALL support base-level restore (all tiers), table-level restore (Starter+), and point-in-time selection across any snapshot in the retention window. Restores SHALL never overwrite existing data — they always create new bases or new tables in existing bases.

#### Scenario: Base-level restore to a new base

- **WHEN** `web` submits a restore with scope=base, target=`{ workspace_id }`, and the snapshot is within retention
- **THEN** the engine creates a new base in the target Workspace via the Airtable API and writes tables, records, linked records, and attachments in that order

#### Scenario: Table-level restore to existing base

- **WHEN** a Starter+ user submits a restore with scope=table, target=`{ existing_base_id }`
- **THEN** the engine creates a new table in the existing base and writes the table's records and attachments

#### Scenario: Snapshot outside retention rejected

- **WHEN** the requested snapshot timestamp is older than the Space's retention window
- **THEN** the engine sets `restore_runs.status='failed'` with an "out of retention" reason and does not start work

### Requirement: Execution order and verification

The engine SHALL acquire a connection lock, validate the snapshot, write tables → records → linked records → attachments in dependency order, re-upload attachments from R2 / source destination to Airtable's attachment endpoint, and on Growth+ run post-restore verification (record count match, error count, audit log) recording the result on `restore_runs.verification_status`.

#### Scenario: Linked record cycle

- **WHEN** the snapshot contains tables with mutual linked-record references
- **THEN** the engine writes records first, then back-fills linked-record cells in a second pass, so all references resolve

#### Scenario: Verification mismatch

- **WHEN** post-restore verification on a Growth+ run finds a record-count mismatch
- **THEN** `verification_status` is set to `mismatch`, the result is included in the Restore Complete email, and the audit log captures the diff

### Requirement: Community Restore Tooling for non-restorable entities

For entities Airtable's API cannot restore automatically (Automations, Interfaces) on Pro+, the engine SHALL generate an AI-prompt bundle (captured entity content + curated prompt template + step-by-step instructions) and expose it via `GET /spaces/{id}/restore-bundle/{run_id}` for front to render.

#### Scenario: Pro+ restore includes Automations

- **WHEN** a Pro+ restore covers a base whose snapshot includes Automations
- **THEN** the bundle endpoint returns the Automations content, an AI prompt template, and instructions for executing the manual restore via the Airtable API

### Requirement: Restore credit accounting

The engine SHALL track free restores per month in `organization_restore_usage` and debit `credit_transactions` for excess restores at the rates 15 (table), 40 (base records), 75 (base records + attachments).

#### Scenario: Excess restore consumes credits

- **WHEN** a base-records-and-attachments restore is the (N+1)th in a period and the Org's `included_restores_per_month` is N
- **THEN** the engine writes a `credit_transactions` row debiting 75 credits and links it to the `restore_runs.id`

### Requirement: Restore Complete notification

On final status, the engine SHALL send the `server`-owned Restore Complete email to the configured notification recipients with the run's outcome, counts, and (on Growth+) verification result.

#### Scenario: Successful restore email

- **WHEN** a restore finishes with `status='success'`
- **THEN** the Restore Complete email is sent within 1 minute with totals and a link to the run detail page
