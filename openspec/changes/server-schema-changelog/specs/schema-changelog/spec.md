# schema-changelog

The engine assembles a per-Space schema changelog feed at read time by unioning
already-persisted diff data — lifecycle added/removed, `bo_at_schema_updates`
modifications, and automation/interface status/config — into dated, base ▸
entity–located entries, exposed on an internal route.

## ADDED Requirements

### Requirement: Read-time changelog assembly from persisted diff data

The engine SHALL assemble the changelog on read by unioning (a) entity lifecycle
(`status='removed'` at `first_unseen_run` → `removed`; post-baseline
`firstSeenRun` → `added`) for base/table/field/view, (b) `bo_at_schema_updates`
modifications (`kind='modified'`, carrying the raw `changeType` —
`name|type|options|description|primary_field` — with `before`/`after` and the
`breaksData` flag), and (c) automation/interface status transitions and config
changes. The web derives the display taxonomy (renamed/retyped/config) from
`changeType` client-side. It SHALL NOT introduce a new persisted changelog table
and SHALL NOT re-capture or re-diff Airtable to build the feed.

#### Scenario: Field rename and add appear as entries

- **WHEN** a base's most recent run renamed a field and added a table relative to the prior run
- **THEN** the feed contains a `modified` entry with `changeType='name'` (with before→after) and an `added` entry, each locatable by base ▸ entity identifiers

#### Scenario: Field type change carries the breaks-data flag

- **WHEN** a field's type changed between runs (a `bo_at_schema_updates` row with `breaks_data = true`)
- **THEN** the corresponding `modified` entry carries `breaksData: true` and its before→after values

#### Scenario: Baseline capture does not flood the feed with added entries

- **WHEN** a base's first (baseline) run captured its entire schema
- **THEN** no `added` entries are emitted for baseline entities — only entities first seen on a later run yield `added`

#### Scenario: Automation status change is an app-layer entry

- **WHEN** an automation transitioned status (e.g. active → removed) between runs
- **THEN** the feed contains an entry with `entityType='automation'` and before→after status values

### Requirement: Entries are dated by their run and locatable by identifiers

Each entry SHALL carry an ISO `at` resolved from the observing run's
`bo_at_base_runs` row (`completed_at ?? started_at`, via `first_unseen_run` /
`firstSeenRun` / `schema_updates.runId`), plus location identifiers (`baseId`,
`tableId` where applicable, `entityId`, and `entityName` where the source row
carries it) sufficient for the web to resolve display names from the SSR entity
index it already holds. Engine-rendered `summary` strings are NOT required
(deferred — web renders wording client-side).

#### Scenario: Entry dated by observing run

- **WHEN** an entry is built from a `schema_updates` row
- **THEN** its `at` equals the completion (or start) timestamp of the `bo_at_base_runs` row referenced by that update's `runId`

#### Scenario: Web resolves location without a second request

- **WHEN** the web receives an entry
- **THEN** it can resolve the base ▸ table ▸ entity breadcrumb from the entry's identifiers plus the SSR schema payload, without a second engine request

### Requirement: Filters — base, limit, since, kinds, include-removed

The changelog route SHALL require `baseId` (scope to one base) and SHALL accept
`limit` (1–1000, default 200), `since` (ISO cutoff on the entry's run date),
`kinds` (comma-separated entry kinds), and `includeRemoved` (default true;
`false` omits `removed` entries), applying them to the assembled feed.

#### Scenario: Since cutoff

- **WHEN** the request passes `since=<iso>`
- **THEN** only entries whose run date is at or after the cutoff are returned

#### Scenario: Excluding removals

- **WHEN** the request passes `includeRemoved=false`
- **THEN** `removed` entries are excluded from the feed

### Requirement: Internal route, token-gated and readiness/IDOR-guarded

The engine SHALL expose `GET /api/internal/spaces/:spaceId/schema-changelog`
returning `{ ok, entries }`, gated by the `INTERNAL_TOKEN` header (via middleware
on the `/api/internal/` prefix) and guarded exactly like `relationships-overview`
(`resolveSpaceDb` → `managed_pg` check → `ensureSpaceSchemaCurrent` →
`withSpaceSchema`). It SHALL return a 200 with `entries: []` for a Space with no
diffable history and SHALL NOT add any public surface.

#### Scenario: Missing internal token

- **WHEN** the route is called without a valid `x-internal-token` header
- **THEN** the request is rejected (401) by the internal-prefix middleware gate

#### Scenario: Space with a single run

- **WHEN** a Space has only one backup run (no prior snapshot to diff)
- **THEN** the route returns 200 with `entries: []`

#### Scenario: Partial capture never emits false removals

- **WHEN** a run captured a base partially (not confident)
- **THEN** absent entities are treated as `unknown`, and no `removed` entries are produced for them
