## ADDED Requirements

### Requirement: Browser-to-SpaceDO WebSocket fan-out
`apps/web` SHALL expose a WebSocket route at `GET /api/ws/spaces/:id/progress` that, after session + Space-ownership validation, forwards the WebSocket upgrade to `apps/server`'s `SpaceDO` via a cross-Worker Durable Object namespace binding. After the upgrade, progress and completion frames SHALL flow directly from the DO to all attached browsers.

#### Scenario: unauthenticated upgrade is rejected
- **WHEN** a browser opens a WebSocket to `/api/ws/spaces/:id/progress` without a valid session
- **THEN** the route SHALL return HTTP 401
- **AND** SHALL NOT forward to the SpaceDO

#### Scenario: wrong-org upgrade is rejected
- **WHEN** a browser opens a WebSocket with a valid session that does not own (or is not a member of) the target Space
- **THEN** the route SHALL return HTTP 403
- **AND** SHALL NOT forward to the SpaceDO

#### Scenario: authorized upgrade succeeds
- **WHEN** a browser opens a WebSocket with a valid session that owns the target Space
- **THEN** the route SHALL forward to `env.SPACE_DO.idFromName(spaceId).fetch(upgradeRequest)`
- **AND** the SpaceDO SHALL accept the upgrade via `state.acceptWebSocket(server)`
- **AND** the browser SHALL receive an HTTP 101 Switching Protocols response

### Requirement: SpaceDO broadcasts progress and completion events
On every `/api/internal/runs/:runId/progress` and `/api/internal/runs/:runId/complete` POST, the route handler SHALL bump DO state AND broadcast a JSON frame to every WebSocket currently attached to that SpaceDO instance.

#### Scenario: progress event fans out
- **WHEN** `apps/workflows`'s backup-base task POSTs to `/api/internal/runs/:runId/progress` with `{ triggerRunId, atBaseId, recordsAppended, tableCompleted }`
- **THEN** the SpaceDO SHALL send a frame `{ type: 'progress', runId, atBaseId, recordsAppended, tableCompleted }` to every attached WebSocket
- **AND** the apps/web Worker SHALL NOT be in the per-frame path

#### Scenario: completion event fans out
- **WHEN** the backup-base task POSTs to `/api/internal/runs/:runId/complete` with `{ status, tablesProcessed, recordsProcessed, attachmentsProcessed, errorMessage? }`
- **THEN** the SpaceDO SHALL send a frame `{ type: 'complete', runId, status, tablesProcessed, recordsProcessed, attachmentsProcessed, errorMessage }` to every attached WebSocket

#### Scenario: multiple attached browsers
- **WHEN** three browsers are attached to the same SpaceDO's WebSocket set
- **THEN** a single progress POST SHALL produce three sent frames (one per attached socket)

### Requirement: Hibernation-safe WebSocket attachment
SpaceDO WebSockets SHALL be attached via the workerd WebSocket-hibernation API (`state.acceptWebSocket(...)` + `webSocketMessage` / `webSocketClose` / `webSocketError` handlers). The list of attached sockets SHALL be sourced from `state.getWebSockets()` and SHALL NOT be cached in a JS-side field that would be lost on hibernation.

#### Scenario: hibernation preserves the broadcast set
- **WHEN** a SpaceDO with two attached WebSockets hibernates and is rehydrated by an incoming progress POST
- **THEN** the rehydrated DO SHALL find both sockets via `state.getWebSockets()`
- **AND** SHALL deliver the progress frame to both

### Requirement: Client reconnect + safety poll
The browser-side consumer SHALL transparently reconnect dropped WebSockets with exponential backoff (250ms → 30s cap) and SHALL fall back to a 30-second `GET /api/spaces/:id/runs` poll while disconnected. After a successful reconnect, the consumer SHALL fetch `/runs` once to reconcile missed events, then stop the safety poll.

#### Scenario: socket drop triggers reconnect
- **WHEN** an attached WebSocket fires `close` or `error`
- **THEN** the consumer SHALL wait the next backoff interval
- **AND** SHALL open a new WebSocket to the same route
- **AND** SHALL emit `event: 'progress_socket_reconnecting'` on each retry

#### Scenario: safety poll covers disconnect window
- **WHEN** the WebSocket has been disconnected for ≥30 seconds and no successful reconnect has occurred
- **THEN** the consumer SHALL invoke `GET /api/spaces/:id/runs` every 30 seconds until the reconnect succeeds
- **AND** SHALL stop polling on the first successful reconnect

### Requirement: WebSocket frame schema is the cross-app contract
Progress and completion frames SHALL share JSON shape with the existing `/api/internal/runs/:runId/progress` and `/api/internal/runs/:runId/complete` POST payloads — same field names, same types — so that one wire shape governs both the engine-callback contract and the WebSocket fan-out.

#### Scenario: schema parity with internal POSTs
- **WHEN** the SpaceDO emits a progress frame
- **THEN** the JSON shape SHALL match `{ type: 'progress' } & ProgressPostPayload`
- **AND** the consumer SHALL be able to dispatch via the same reducer that handles the REST `/runs` response shape (after type discrimination on `frame.type`)
