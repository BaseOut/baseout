# schema-changelog

The engine assembles a per-Space schema changelog feed at read time by unioning
already-persisted diff data — lifecycle added/removed, `bo_at_schema_updates`
modifications, and automation/interface status/config — into dated, base ▸
entity–located events, exposed on an internal route.

## ADDED Requirements

### Requirement: Read-time changelog assembly from persisted diff data

The engine SHALL assemble the changelog on read by unioning (a) entity lifecycle
(`firstSeenRun` → `added`; `status='removed'` at `lastSeenRun` → `removed`) for
base/table/field/view, (b) `bo_at_schema_updates` modifications
(`name`→`renamed`, `type`→`retyped`, `options|description|primary_field`→`config`)
with `beforeValue`/`afterValue`, and (c) automation/interface status transitions
and config changes. It SHALL NOT introduce a new persisted changelog table and
SHALL NOT re-capture or re-diff Airtable to build the feed.

#### Scenario: Field rename and add appear as events

- **WHEN** a base's most recent run renamed a field and added a table relative to the prior run
- **THEN** the feed contains a `renamed` event (with before→after) and an `added` event, each located by base ▸ entity

#### Scenario: Field type change carries a breaks-data warning

- **WHEN** a field's type changed between runs (a `bo_at_schema_updates` row with `breaks_data = true`)
- **THEN** the corresponding `retyped` event carries a `warning` and its before→after values

#### Scenario: Automation status change is an app-layer config event

- **WHEN** an automation transitioned status (e.g. active → removed) between runs
- **THEN** the feed contains a `config` event tagged `entityKind='automation'` with a before→after summary (e.g. "Active → Inactive")

### Requirement: Events are dated by their run and located as base ▸ entity

Each event SHALL carry an ISO `at` resolved from the observing run's
`bo_at_base_runs.started_at` (via `firstSeenRun` / `lastSeenRun` /
`schema_updates.runId`), and SHALL carry location fields (`baseName`, optional
`tableName`, `entityKind`/`entityName` for app-layer, `fieldType` for fields) plus
an engine-rendered human-readable `summary` so the web styles rather than composes
the string.

#### Scenario: Event dated by observing run

- **WHEN** an event is built from a `schema_updates` row
- **THEN** its `at` equals the `started_at` of the `bo_at_base_runs` row referenced by that update's `runId`

#### Scenario: Location and summary are engine-provided

- **WHEN** the web receives an event
- **THEN** it has `baseName`, the entity's name/kind, and a rendered `summary`, without needing a second request to resolve the location

### Requirement: Filters — base, since, kinds, include-removed

The changelog route SHALL accept `baseId` (scope to one base), `since` (ISO
cutoff on the event's run `started_at`), `kinds` (comma-separated event kinds), and
`includeRemoved` (default false omits `removed` events), and SHALL apply them to
the assembled feed.

#### Scenario: Since cutoff

- **WHEN** the request passes `since=<iso>`
- **THEN** only events whose run started at or after the cutoff are returned

#### Scenario: Include-removed default

- **WHEN** the request omits `includeRemoved` (or passes false)
- **THEN** `removed` events are excluded from the feed

### Requirement: Internal route, token-gated and readiness/IDOR-guarded

The engine SHALL expose `GET /api/internal/spaces/:spaceId/changelog` returning
`{ ok, events }`, gated by the `INTERNAL_TOKEN` header (via middleware on the
`/api/internal/` prefix) and guarded exactly like `relationships-overview`
(`resolveSpaceDb` → `managed_pg` check → `ensureSpaceSchemaCurrent` →
`withSpaceSchema`). It SHALL return a 200 with `events: []` for a Space with no
diffable history and SHALL NOT add any public surface.

#### Scenario: Missing internal token

- **WHEN** the route is called without a valid `x-internal-token` header
- **THEN** the request is rejected (401) by the internal-prefix middleware gate

#### Scenario: Space with a single run

- **WHEN** a Space has only one backup run (no prior snapshot to diff)
- **THEN** the route returns 200 with `events: []`

#### Scenario: Partial capture never emits false removals

- **WHEN** a run captured a base partially (not confident)
- **THEN** absent entities are treated as `unknown`, and no `removed` events are produced for them
