## ADDED Requirements

### Requirement: Authenticated Rescan proxy

The frontend SHALL expose `POST /api/spaces/:spaceId/rescan-bases` as an authenticated, IDOR-checked entry point that proxies to the engine's `POST /api/internal/spaces/:spaceId/rescan-bases` via the `BACKUP_ENGINE` service binding. The route SHALL never trust unauthenticated callers.

#### Scenario: Unauthenticated request

- **WHEN** a request hits `POST /api/spaces/:spaceId/rescan-bases` without a valid session
- **THEN** the route SHALL respond 401
- **AND** the engine binding SHALL NOT be called

#### Scenario: Cross-Org request

- **WHEN** the session's Org does not own the Space identified by `:spaceId`
- **THEN** the route SHALL respond 403
- **AND** the engine binding SHALL NOT be called

#### Scenario: Engine reports connection_not_found

- **WHEN** the engine returns `{ ok: false, code: 'connection_not_found' }`
- **THEN** the route SHALL respond 409
- **AND** the response body SHALL be `{ "error": "connection_not_found" }`

#### Scenario: Engine binding misconfigured

- **WHEN** `env.BACKUP_ENGINE` or `env.BACKUP_ENGINE_INTERNAL_TOKEN` is absent at runtime
- **THEN** the route SHALL respond 503 with `{ "error": "server_misconfigured", "message": "..." }`
- **AND** no upstream call SHALL be made

### Requirement: Banner reads unread space_events

`getIntegrationsState` SHALL return up to 10 unread `space_events` rows (where `dismissed_at IS NULL`) ordered by `created_at DESC`, filtered to recognised `kind` values. For each event, the function SHALL defensively parse the JSON payload — non-array fields SHALL be coerced to empty arrays rather than allowed to propagate as `undefined`.

#### Scenario: Multiple unread events

- **GIVEN** a Space with three unread `bases_discovered` events
- **WHEN** `getIntegrationsState(spaceId, db, account)` is called
- **THEN** the returned `unreadEvents` SHALL contain three entries
- **AND** the first entry SHALL correspond to the event with the most recent `created_at`

#### Scenario: Malformed payload

- **WHEN** an event row's payload has `discovered: "not-an-array"`
- **THEN** the mapping SHALL coerce `discovered` to `[]`
- **AND** the event SHALL still be included in the result

### Requirement: Banner dismiss endpoint

The frontend SHALL expose `POST /api/spaces/:spaceId/space-events/:eventId/dismiss` that idempotently marks one event dismissed. The endpoint SHALL enforce authentication, Org-matching IDOR, and event-belongs-to-Space.

#### Scenario: Event belongs to a different Space

- **GIVEN** event `e1` belongs to Space `s1`
- **WHEN** the caller requests `POST /api/spaces/s2/space-events/e1/dismiss`
- **THEN** the route SHALL respond 404 (existence not disclosed)
- **AND** the event's `dismissed_at` column SHALL remain unchanged

#### Scenario: Already dismissed

- **GIVEN** event `e1` already has `dismissed_at` set
- **WHEN** the caller requests `POST /api/spaces/s1/space-events/e1/dismiss`
- **THEN** the route SHALL respond 200
- **AND** the `dismissed_at` value SHALL NOT be overwritten

### Requirement: Auto-add toggle persistence

The existing `PATCH /api/spaces/:spaceId/backup-config` route SHALL accept `autoAddFutureBases: boolean` as a body field. The validator SHALL accept booleans only and SHALL reject other types as `invalid_request`. The empty-body rejection SHALL hold only when none of `frequency`, `storageType`, or `autoAddFutureBases` is present.

#### Scenario: Toggle on without other fields

- **WHEN** the caller sends `PATCH .../backup-config` with body `{ "autoAddFutureBases": true }`
- **THEN** the route SHALL respond 200
- **AND** the upserted config row SHALL have `auto_add_future_bases = true`

#### Scenario: Non-boolean value

- **WHEN** the caller sends `PATCH .../backup-config` with body `{ "autoAddFutureBases": "yes" }`
- **THEN** the route SHALL respond 400 with `{ "error": "invalid_request" }`
- **AND** the database SHALL NOT be touched
