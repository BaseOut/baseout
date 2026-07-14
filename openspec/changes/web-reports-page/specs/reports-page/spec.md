# reports-page

The Reports page in apps/web: proxy routes, capability gating, and authorized
artifact downloads over the `shared-backup-reports` engine surface, plus the
ported ui-only Reports UI (list, generate-now, sectioned report view, schedules).

## ADDED Requirements

### Requirement: Reports page replaces the placeholder

`/reports` SHALL render the real Reports page — report list (period covered,
generated-at, manual/scheduled trigger, delivery status), **Run report now**,
and schedule management — retiring the `PlaceholderView` for this route. A Space
with no backups SHALL show an empty state pointing at Backups.

#### Scenario: First report
- **WHEN** a user with backup history clicks Run report now
- **THEN** a run appears generating and resolves to a report covering "since the first backup"

### Requirement: Proxied report reads and schedule writes

All Reports reads and actions SHALL go through `apps/web` proxy routes under
`/api/spaces/:spaceId/reports/*` (middleware-guarded, capability-gated)
forwarding to the engine's `INTERNAL_TOKEN`-gated routes via the `BACKUP_ENGINE`
service binding. Schedule writes SHALL validate recipient emails and enforce the
recipient cap server-side; manual run + in-app view and scheduled email delivery
SHALL gate as separate capability checks resolved from Stripe metadata.

#### Scenario: Below-tier schedule write
- **WHEN** an account entitled to view reports but not to scheduled delivery creates a schedule
- **THEN** the proxy rejects it server-side and the UI shows the delivery upgrade affordance

### Requirement: Sectioned report view with clickable references

The report detail view SHALL render the versioned JSON document's four sections
(backup summary · connection health · schema health · documentation updates),
rendering `{status: "clean"}` sections as "no issues" rather than omitting them.
Every typed entity ref SHALL be clickable: schema entities open the shared
entity detail sidebar, backup runs open run detail, docs open the doc, and
external destination copies link out to the storage location.

#### Scenario: Navigate from a report
- **WHEN** a user clicks a failed backup run referenced in the backup summary section
- **THEN** the run detail view opens for that run

### Requirement: Authorized artifact downloads

PDF and HTML exports SHALL download only through a web route that verifies the
session and Space membership before resolving the artifact through the engine
and streaming it. Artifact storage locations SHALL never be exposed to
unauthorized callers.

#### Scenario: Unauthorized artifact request
- **WHEN** a request without a valid Space-member session hits an artifact URL
- **THEN** the route refuses without touching artifact storage

### Requirement: Schedule and delivery visibility

The Schedules UI SHALL manage cadence (after every backup / daily / weekly /
monthly), recipients, attached format (PDF and/or HTML link), and enable/pause —
and SHALL surface per-recipient delivery status (`sent`/`failed` with error) on
past runs, with a manual re-send affordance for failed deliveries.

#### Scenario: Partial delivery failure
- **WHEN** a scheduled report sends to two recipients and one fails
- **THEN** the run stays complete, the failed recipient shows its error, and re-send is offered
