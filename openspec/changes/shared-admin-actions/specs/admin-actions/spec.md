## ADDED Requirements

### Requirement: Append-only admin audit log

The master DB SHALL contain an `admin_audit_log` table (canonical schema and migration owned by `apps/web`; `apps/admin` holds a writable mirror). Rows SHALL be append-only: no application code path may UPDATE or DELETE a row. Each audited action SHALL produce an `intent` row **before** the action executes and SHOULD produce a `result` row (linked via `intent_id`) after it completes. Actor identity SHALL be stored as denormalized snapshots (`actor_user_id`, `actor_email`) with no foreign key, so audit history survives user deletion. `params` SHALL never contain tokens, secrets, or encrypted-column values.

#### Scenario: Intent precedes execution

- **WHEN** a staff user triggers an admin action
- **THEN** an `admin_audit_log` row with `phase='intent'` is INSERTed before any domain-table write or engine call, and if that INSERT fails the action does not execute

#### Scenario: Result row records the outcome

- **WHEN** an audited action finishes (success or failure)
- **THEN** a `phase='result'` row is appended with `intent_id` referencing the intent row and outcome details in `params`; a missing result row (e.g. Worker death mid-action) is interpreted as "outcome unknown" with domain tables as ground truth

#### Scenario: No mutation path exists

- **WHEN** the admin codebase is inspected
- **THEN** no call site updates or deletes `admin_audit_log` rows (enforced by a guard test; DB-role enforcement is deferred to the parent umbrella)

### Requirement: Write-then-execute helper with durable rate limiting

Admin actions SHALL run exclusively through a `runAudited` helper that (1) refuses to execute when the actor has ≥10 audit intents in the trailing 60 seconds, returning `rate_limited` without writing anything; (2) refuses to execute when the intent INSERT fails (`audit_write_failed`); (3) records an `exception` result row when the action throws. The rate counter SHALL be derived from `admin_audit_log` itself so it is durable across Worker isolates.

#### Scenario: Rate limit trips

- **WHEN** a staff user triggers an 11th action within 60 seconds
- **THEN** the route returns 429 `rate_limited` and no intent row is written

### Requirement: Same-origin enforcement on action routes

Every mutating admin route SHALL reject requests whose `Origin` header is missing or differs from the request's own origin (403 `bad_origin`), in addition to the SameSite=Lax session cookie.

#### Scenario: Cross-origin POST is rejected

- **WHEN** a POST arrives with `Origin: https://evil.example`
- **THEN** the route returns 403 and no audit row or domain write occurs

### Requirement: Force backup action

Staff SHALL be able to trigger a backup run for any Space from the Organizations → Spaces tracker, behind an explicit confirmation dialog. The action SHALL follow web's run-start contract: require an `active` Airtable connection and ≥1 included base, INSERT a `backup_runs` row (`status='queued'`, `triggered_by='admin'`, `is_trial=false`), POST the engine's `/api/internal/runs/:id/start`, and DELETE the orphan run row if the engine rejects with a 4xx. If the engine binding or internal token is absent the route SHALL return 503 `server_misconfigured` without writing a run row.

#### Scenario: Successful force backup

- **WHEN** staff confirms "Force backup" on a Space with an active connection and included bases
- **THEN** a run row appears with `status='queued'` and `triggered_by='admin'`, the engine fan-out starts, and intent + result audit rows record the runId

#### Scenario: Engine rejects the run

- **WHEN** the engine responds 4xx to the start call
- **THEN** the queued run row is deleted, the result audit row records the failure code, and the staff user sees the error

### Requirement: Invalidate connection action

Staff SHALL be able to mark any non-invalid connection `status='invalid'` (setting `invalidated_at`) from the connection-health surface, behind an explicit confirmation dialog. After the flip the action SHALL attempt to cancel every `queued` or `running` backup run on that connection via the engine, recording per-run outcomes in the result audit row; cancel failures SHALL NOT roll back the invalidation, and a missing engine binding degrades to `skipped_no_engine`.

#### Scenario: Invalidate with in-flight runs

- **WHEN** staff confirms invalidation of an `active` connection that has a running backup
- **THEN** `connections.status` becomes `'invalid'` (the `connection_status_audit` trigger records the flip independently), the run is cancelled best-effort, and the customer's app shell shows the broken-connection banner

#### Scenario: Already invalid

- **WHEN** staff targets a connection whose status is already `'invalid'`
- **THEN** the route returns 409 `already_invalid` and writes no audit rows

### Requirement: Force migration completion action

Staff SHALL be able to mark a pending On2Air organization migrated (`organizations.has_migrated = true`) from the migration surface, behind an explicit confirmation dialog. `dynamic_locked` SHALL NOT be modified by this action.

#### Scenario: Force-complete a pending migration

- **WHEN** staff confirms "Mark migrated" on an org with `has_migrated=false`
- **THEN** the org's `has_migrated` becomes true, it leaves the pending list, and intent + result audit rows record the change

### Requirement: Deferred billing actions

Reset trial, adjust plan, and grant credits SHALL remain deferred until the credit-ledger schema (`server-manual-quota-and-credits`) and a Stripe webhook sync exist. The `admin_audit_log` schema SHALL accommodate them without change (new `action` string values + jsonb `params`).

#### Scenario: Billing actions absent

- **WHEN** staff views any admin surface in this change's scope
- **THEN** no reset-trial, adjust-plan, or grant-credits control is present
