## ADDED Requirements

### Requirement: Single-writer orchestrator

The engine SHALL define a single pure-function orchestrator `runWorkspaceRediscovery` at [apps/server/src/lib/rediscovery/run.ts](../../../../apps/server/src/lib/rediscovery/run.ts). Every rediscovery entry point — manual rescan route (Phase 2) and `SpaceDO.alarm` (Phase 3, deferred) — SHALL route through this orchestrator. No rediscovery side-effect SHALL bypass it.

#### Scenario: Manual rescan and alarm share policy

- **WHEN** a manual rescan is invoked via `POST /api/internal/spaces/:id/rescan-bases`
- **AND** a SpaceDO alarm fires for the same Space at a different time
- **THEN** both paths SHALL apply identical auto-add and tier-cap logic, differing only in the `triggeredBy` discriminant written to `at_bases.discovered_via` for freshly-inserted rows

### Requirement: Upsert all listed bases per rediscovery

Every rediscovery call SHALL upsert one `at_bases` row per Airtable workspace base, regardless of whether the base is new or known. The upsert SHALL bump `last_seen_at` to the current clock for known bases and SHALL set `discovered_via`, `first_seen_at`, and `last_seen_at` on inserts. The upsert SHALL NOT overwrite `discovered_via` on known rows.

#### Scenario: Known base bumped on every rescan

- **WHEN** a rediscovery runs against a workspace whose bases are all already in `at_bases`
- **THEN** every `at_bases` row's `last_seen_at` SHALL be updated to the current clock
- **AND** the function SHALL return `{ discovered: 0, autoAdded: 0, blockedByTier: 0 }`
- **AND** no `space_events` row SHALL be inserted

#### Scenario: Fresh base discovered via manual rescan

- **WHEN** a workspace contains a base that is not yet in `at_bases` and the manual rescan path runs
- **THEN** the new `at_bases` row SHALL carry `discovered_via = 'rediscovery_manual'`
- **AND** `first_seen_at` SHALL equal `last_seen_at` SHALL equal the current clock

### Requirement: Auto-add toggle determines inclusion

When `backup_configurations.auto_add_future_bases = false`, fresh bases SHALL be discovered (upserted into `at_bases`) but SHALL NOT be inserted into `backup_configuration_bases`. The orchestrator SHALL still insert a `space_events` row with `kind = 'bases_discovered'` so the UI can surface a banner.

When `auto_add_future_bases = true`, fresh bases SHALL be inserted into `backup_configuration_bases` with `is_included = true` and `is_auto_discovered = true`, subject to the tier cap.

#### Scenario: Toggle off

- **WHEN** rediscovery runs with `auto_add_future_bases = false` and finds 3 fresh bases
- **THEN** zero rows SHALL be inserted into `backup_configuration_bases`
- **AND** one `space_events` row SHALL be inserted with `payload.discovered = [3 ids]`, `payload.autoAdded = []`, `payload.blockedByTier = []`, and `payload.tierCap = <resolved cap>`

#### Scenario: Toggle on, under cap

- **WHEN** rediscovery runs with `auto_add_future_bases = true`, 2 fresh bases, currently-included count = 1, tier cap = 5
- **THEN** 2 `backup_configuration_bases` rows SHALL be inserted with `is_included = true, is_auto_discovered = true`
- **AND** one `space_events` row SHALL be inserted with `payload.autoAdded` containing both fresh ids, `payload.blockedByTier = []`

#### Scenario: Toggle on, over cap

- **WHEN** rediscovery runs with `auto_add_future_bases = true`, 4 fresh bases, currently-included count = 4, tier cap = 5
- **THEN** exactly 1 `backup_configuration_bases` row SHALL be inserted
- **AND** the `space_events` row SHALL carry `payload.autoAdded` with 1 id and `payload.blockedByTier` with the other 3

#### Scenario: Enterprise tier (null cap)

- **WHEN** rediscovery runs with `auto_add_future_bases = true` and `resolveTierCap` returns `null`
- **THEN** every fresh base SHALL be auto-added
- **AND** `payload.blockedByTier` SHALL be empty
- **AND** `payload.tierCap` SHALL be `null` in the event row

### Requirement: Airtable error surfaces cleanly

When `listAirtableBases()` throws an `AirtableError`, the orchestrator SHALL surface the error to the caller without writing any DB rows in the call. The route layer SHALL map this to HTTP 502 with the upstream status code.

#### Scenario: Airtable 503 during rescan

- **WHEN** Airtable's Meta API returns 503 during `listBases()`
- **THEN** `runWorkspaceRediscovery` SHALL throw the `AirtableError`
- **AND** the manual rescan route SHALL respond `502 { error: 'airtable_error', upstream_status: 503 }`
- **AND** no `at_bases`, `backup_configuration_bases`, or `space_events` rows SHALL be written by the call

### Requirement: Idempotent under concurrent calls

Two concurrent rediscovery calls for the same Space SHALL converge correctly. `at_bases` and `backup_configuration_bases` upserts SHALL use `ON CONFLICT` clauses such that either ordering produces consistent state. `space_events` is append-only; both calls' rows SHALL land.

#### Scenario: Two rescans race

- **WHEN** two POSTs to `/api/internal/spaces/:id/rescan-bases` execute in parallel
- **THEN** every `at_bases` row's `last_seen_at` SHALL reflect the later of the two clocks
- **AND** every `backup_configuration_bases` row SHALL have `is_included = true`
- **AND** two `space_events` rows SHALL exist

### Requirement: INTERNAL_TOKEN gate

The manual rescan route SHALL be reached only via the `INTERNAL_TOKEN`-gated `/api/internal/*` prefix per [CLAUDE.md §5.2](../../../../CLAUDE.md). A request without the `x-internal-token` header (or with the wrong value) SHALL return 401 before the route handler executes.

#### Scenario: Missing token

- **WHEN** a request hits `POST /api/internal/spaces/:id/rescan-bases` without the `x-internal-token` header
- **THEN** the middleware SHALL return 401
- **AND** the route handler SHALL NOT run

### Requirement: Tier-cap resolver mirrors apps/web

The engine-side capability resolver under [apps/server/src/lib/capabilities/](../../../../apps/server/src/lib/capabilities/) SHALL produce the same `basesPerSpace` value for the same `(organizationId, platformSlug)` as the canonical resolver in [apps/web/src/lib/capabilities/](../../../../apps/web/src/lib/capabilities/). Drift between the two SHALL be treated as a bug.

#### Scenario: Engine and web agree on cap

- **GIVEN** an Org on the Growth tier with an active Airtable subscription
- **WHEN** both `resolveCapabilities(db, orgId, 'airtable')` in `apps/web` and `resolveCapabilities(db, orgId, 'airtable')` in `apps/server` are called
- **THEN** both SHALL return `{ tier: 'growth', capabilities: { basesPerSpace: 15 } }`
