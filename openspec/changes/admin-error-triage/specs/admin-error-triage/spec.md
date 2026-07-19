## ADDED Requirements

### Requirement: Aggregated error queue

The admin console SHALL provide an `/errors` page that aggregates open error items from the master DB into a single queue. The queue SHALL include exactly these five sources:

1. **Failed backup runs** — `backup_runs` rows with `status = 'failed'`
2. **Failed bases within non-failed runs** — `backup_run_bases` rows with `status = 'failed'` whose parent run's status is not `'failed'` (partial failures)
3. **Failed restore runs** — `restore_runs` rows with `status = 'failed'`
4. **Connection errors** — `connections` rows with `status IN ('invalid', 'pending_reauth')`, or with a non-null `oauth_refresh_last_error` while `status IN ('active', 'refreshing')`
5. **Per-Space DB errors** — `space_databases` rows with `status = 'error'`

Each queue item SHALL display: error type, the stored error message (`error_message` / `oauth_refresh_last_error`; connection-status errors without a message show the status), the affected Space and Organization as links, when the error occurred, and the source row's current state. The page SHALL read only tables already mirrored in `apps/admin` plus `admin_error_acks`, and SHALL NOT touch per-Space databases or any `*_enc` column.

#### Scenario: Failed run appears with account context

- **WHEN** a backup run for a Space finishes with `status='failed'`
- **THEN** `/errors` lists an item of type "backup run failed" showing the run's `error_message`, linking to the Space's Organization drill-in and the run drill-in (`/backups/[id]`)

#### Scenario: Partial failure surfaces independently

- **WHEN** a run completes `succeeded` overall but one `backup_run_bases` row has `status='failed'`
- **THEN** `/errors` lists a "base backup failed" item for that base naming the base and its parent run, even though the run itself is not in the queue

#### Scenario: Connection stuck refreshing

- **WHEN** a connection has `status='refreshing'` and a non-null `oauth_refresh_last_error`
- **THEN** `/errors` lists a "connection refresh error" item carrying that error text

### Requirement: Organization grouping and filtering

The error queue SHALL be grouped by Organization with the most recently erroring Organizations first, and items newest-first within each group. The page SHALL support filtering by error type (the five sources) and by acknowledged state (`open` — default, `acknowledged`, `all`). Filter state SHALL be expressed in query parameters so views are shareable between staff.

#### Scenario: Default view hides acknowledged items

- **WHEN** staff opens `/errors` with no query parameters
- **THEN** only unacknowledged items are shown, grouped by Organization

#### Scenario: Filtering by type

- **WHEN** staff selects the "connection" type filter
- **THEN** only connection-error items are listed and the URL reflects the filter (e.g. `?type=connection`)

### Requirement: Append-only acknowledgement records

The master DB SHALL contain an `admin_error_acks` table (canonical schema and migration owned by `apps/web`; `apps/admin` holds a writable partial mirror). Rows SHALL be append-only: no application code path may UPDATE or DELETE a row. Each row SHALL record `phase` (`'ack'` or `'unack'`), `target_type` + `target_id` identifying the error source row, denormalized actor snapshots (`acked_by_user_id`, `acked_by_email`) with no FK to `users`, an optional free-text `note`, and `organization_id` for group queries. An item's effective acknowledged state SHALL be the `phase` of its latest row. Notes and all columns SHALL never contain tokens, secrets, or `*_enc` values.

#### Scenario: Acknowledge marks the item handled

- **WHEN** staff acknowledges a failed-run item with note "customer emailed, rerun scheduled"
- **THEN** an `admin_error_acks` row with `phase='ack'` is inserted, and the item disappears from the default `/errors` view but remains under the `acknowledged` filter with the note and actor email visible

#### Scenario: Un-acknowledge supersedes rather than deletes

- **WHEN** staff un-acknowledges a previously acknowledged item
- **THEN** a new row with `phase='unack'` is appended (the `ack` row is not modified or deleted) and the item returns to the default view

#### Scenario: Recurrence is a new target

- **WHEN** a Space's backup fails again in a new run after the previous failure was acknowledged
- **THEN** the new run is a distinct `target_id` and appears unacknowledged

### Requirement: Audited acknowledge actions

Acknowledge and un-acknowledge SHALL execute through the existing `runAudited()` write-then-execute pipeline as new action values (`acknowledge_error`, `unacknowledge_error`), inheriting the durable rate limit, same-origin CSRF check, and intent/result audit rows. The `admin_error_acks` INSERT is the audited action's domain write; audit `params` SHALL carry the target type/id and whether a note was supplied — not the note body (the note lives in `admin_error_acks`).

#### Scenario: Ack produces audit trail

- **WHEN** staff acknowledges an error item
- **THEN** `admin_audit_log` gains an intent row and a result row for `acknowledge_error`, and `admin_error_acks` gains the `ack` row

#### Scenario: Cross-origin ack rejected

- **WHEN** a POST to the acknowledge route arrives with a foreign `Origin` header
- **THEN** the route returns 403 and neither an audit row nor an ack row is written

### Requirement: Inline remediation reuses existing actions

Error items SHALL expose the already-specced actions from `admin-actions` inline, with their existing confirmation dialogs and semantics unchanged: failed-backup-run items offer **Force backup** for the affected Space; connection-error items whose connection is not already `'invalid'` offer **Invalidate connection**. No new remediation action types SHALL be introduced by this change.

#### Scenario: Rerun from the queue

- **WHEN** staff clicks Force backup on a failed-run item and confirms
- **THEN** the existing force-backup route executes (queued run + engine start + audit rows), identical to triggering it from the Organizations→Spaces tracker

#### Scenario: Already-invalid connection offers no invalidate button

- **WHEN** an error item's connection already has `status='invalid'`
- **THEN** the item shows no Invalidate control (only ack and the link to `/connections`)
