## ADDED Requirements

### Requirement: Trigger sources

The backup engine SHALL accept three trigger sources: scheduled (a cron handler within `baseout-server` writes a `backup_runs` row and invokes the run-start path internally), manual (`baseout-web` writes a `backup_runs` row and POSTs `/runs/{id}/start`), and webhook-driven (an Airtable webhook event is coalesced by the per-Space DO into an incremental run).

#### Scenario: Manual run starts on front trigger

- **WHEN** `baseout-web` POSTs `/runs/{run_id}/start` with a valid service token and `backup_runs.status='pending'`
- **THEN** the engine acknowledges 200, enqueues a Trigger.dev job per base, and updates `backup_runs.status='running'`

#### Scenario: Scheduled run starts on cron trigger

- **WHEN** a cron handler within `baseout-server` inserts a `backup_runs` row with `trigger_type='scheduled'` and invokes the run-start path
- **THEN** the engine processes the run identically to a manual run

#### Scenario: Webhook-driven incremental run

- **WHEN** the per-Space DO's coalescer reaches its event-count or time threshold for a Space with Instant Backup enabled
- **THEN** the engine creates a `backup_runs` row with `trigger_type='webhook'` and starts an incremental run

### Requirement: Backup modes

The engine SHALL support three modes — Static (stream Airtable → CSV/JSON in memory → write to managed R2 or BYOS destination), Dynamic Schema-Only (schema metadata only → D1, available on Trial and Starter), and Dynamic Full (schema + records + attachments → D1 / Shared PG / Dedicated PG / BYODB, available on Launch+). Static-on-BYOS runs MUST stream through memory without ever landing record data on Baseout disk.

#### Scenario: Static backup on BYOS streams without disk write

- **WHEN** a Space configured for static mode with a BYOS destination (Google Drive, Dropbox, Box, OneDrive, S3, or Frame.io) runs a backup
- **THEN** record data streams from Airtable through Worker memory directly to the destination, with no R2 or disk write of record data on Baseout infrastructure

#### Scenario: Dynamic full mode writes to client DB

- **WHEN** a Launch+ Space runs a Dynamic Full backup
- **THEN** schema, records, and attachment metadata are written to the Space's provisioned client DB (D1 / Shared PG / Dedicated PG / BYODB) and attachment binaries are written to R2 or the BYOS destination

### Requirement: Durable Object topology

The engine SHALL use a per-Connection Durable Object as the rate-limit gateway and OAuth-token holder for each `connections.id` and a per-Space Durable Object as the backup state machine, cron-like scheduler, and live-progress event publisher for each `spaces.id`. The per-Connection DO SHALL serialize Airtable API calls when multiple Spaces share a Connection.

#### Scenario: Two Spaces sharing a Connection serialize calls

- **WHEN** two Spaces sharing a single Connection start backup runs simultaneously
- **THEN** the per-Connection DO serializes API calls, with contending Trigger.dev jobs retrying lock acquisition every 5 seconds until the lock is released

#### Scenario: State machine transitions

- **WHEN** a backup run progresses through its lifecycle
- **THEN** the per-Space DO transitions through `idle → running → success` or `idle → running → failed`, never skipping states

### Requirement: Trigger.dev workflow per base

The engine SHALL spawn one Trigger.dev V3 job per base backup, allowing unlimited concurrent runs and no per-run time limits. Each job SHALL acquire a per-Connection lock, stream schema then records page-by-page then attachments, update `backup_run_bases` per base, emit progress events to the per-Space DO, release the lock, and record final status in `backup_runs`.

#### Scenario: Per-base parallelism

- **WHEN** a Space with N bases starts a backup run
- **THEN** N Trigger.dev jobs are enqueued, each isolated by base, and they execute in parallel up to the per-Connection rate-limit budget

#### Scenario: Attachment URL refresh mid-run

- **WHEN** an Airtable attachment URL is within 1 hour of expiry during a long-running job
- **THEN** the engine re-fetches the attachment URL from Airtable before downloading

### Requirement: Trial cap enforcement

For runs where `backup_runs.is_trial=true`, the engine SHALL stop the run when any cap is hit — 1,000 records total across all tables, 5 tables max, or 100 attachments max — set `backup_runs.status='trial_complete'`, set `subscription_items.trial_backup_run_used=true`, and trigger the `baseout-server`-owned Trial Cap Hit email. Subsequent backup runs SHALL be blocked at the run-start gate until the trial converts.

#### Scenario: Run hits 1,000-record cap

- **WHEN** a trial run accumulates 1,000 records across all tables
- **THEN** the engine stops processing further records, sets `status='trial_complete'`, sets `trial_backup_run_used=true`, and sends Trial Cap Hit

#### Scenario: Subsequent run blocked

- **WHEN** a Space with `trial_backup_run_used=true` and an unconverted trial attempts to start another run
- **THEN** the run-start gate refuses the request before any work is done

### Requirement: Attachment dedup and storage

The engine SHALL deduplicate attachments by composite ID `{base}_{table}_{record}_{field}_{attachment}` and skip processing when the same composite ID already exists at the destination. Attachments going to Box or Dropbox SHALL be proxy-streamed.

#### Scenario: Already-stored attachment skipped

- **WHEN** the engine encounters an attachment whose composite ID is already at the destination
- **THEN** the engine skips download and increments a "skipped" counter in the per-base audit row

### Requirement: Static backup file path layout

Static backups SHALL write to the destination using the path `/{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv` where `{user-root}` is the destination's configured root (folder for OAuth destinations, bucket+prefix for S3/R2).

#### Scenario: Static path construction

- **WHEN** a static backup runs for Space "MySpace", Base "ProjectsDB", at 2026-05-02T12:00:00Z, with a table "Tasks"
- **THEN** the file is written to `/{user-root}/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv`

### Requirement: Per-run audit and notifications

The engine SHALL persist a per-run audit (counts, errors, skipped) to master DB `backup_runs` and to a client DB audit-log table, emit per-entity verification rows in `backup_run_bases`, and fire the appropriate `baseout-server`-owned email/in-app notification on failure or warning.

#### Scenario: Run fails partway

- **WHEN** a backup run encounters an unrecoverable error in one base
- **THEN** that base is marked failed in `backup_run_bases`, other bases continue, the overall run records a final aggregate status, and the Backup Failure Alert email fires
