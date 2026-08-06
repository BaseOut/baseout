## ADDED Requirements

### Requirement: Subscription URL pattern is fixed

A WebSocket client SHALL connect to `wss://<server-host>/api/runs/<runId>/progress?token=<hmac>`. The URL is hosted on `apps/server` (the Durable Object emitter), not on `apps/web`.

#### Scenario: Connect with a valid token

- **WHEN** a client opens a WebSocket to `wss://<server-host>/api/runs/<runId>/progress?token=<valid-hmac>`
- **THEN** the server SHALL accept the upgrade
- **AND** the server SHALL begin emitting frames per the schema below
- **AND** the server SHALL replay the most recent `progress` frame (if any) before live frames resume

#### Scenario: Connect with a missing or invalid token

- **WHEN** the `token` query param is missing or fails HMAC verification
- **THEN** the server SHALL reject the upgrade with HTTP `401`
- **AND** the server SHALL NOT begin emitting frames

#### Scenario: Connect with an expired token

- **WHEN** the token's `expiresAtMs` is in the past
- **THEN** the server SHALL reject the upgrade with HTTP `401`
- **AND** the body SHALL indicate `'token_expired'`

### Requirement: Tokens are minted by web via POST /api/me/run-progress-token

The token mint endpoint SHALL be hosted on `apps/web` (which holds the user session). On success, the response body SHALL include the token, the `runId` it's bound to, and the absolute expiry time.

#### Scenario: Authenticated user mints a token for a run they own

- **WHEN** an authenticated user `POST`s `/api/me/run-progress-token` with body `{ runId: '<uuid>' }`
- **AND** the user has access to that run (verified against `backup_runs.space_id` → `spaces.organization_id` → user's membership)
- **THEN** the response SHALL be `200 OK`
- **AND** the body SHALL be `{ token: '<hmac>', runId, expiresAt: '<ISO 8601>' }`
- **AND** the token's `expiresAt` SHALL be exactly 10 minutes after `Date.now()` at mint time

#### Scenario: Unauthenticated request

- **WHEN** the request lacks a valid session cookie
- **THEN** the response SHALL be `401`

#### Scenario: User mints a token for a run they don't own

- **WHEN** the requested `runId` belongs to a different organization than the user's active organization
- **THEN** the response SHALL be `403`

### Requirement: Frame envelope has exactly four type values

Server-emitted frames SHALL be JSON over WebSocket text frames. The `type` field SHALL be one of: `progress`, `complete`, `error`, `heartbeat`. New types require a v2 contract.

#### Scenario: progress frame

- **WHEN** the run advances within a phase
- **THEN** the frame SHALL be JSON shaped as:

  ```json
  {
    "type": "progress",
    "runId": "<uuid>",
    "phase": "discovering" | "fetching" | "writing" | "verifying",
    "recordsDone": <number>,
    "recordsTotal": <number | null>,
    "tablesDone": <number>,
    "tablesTotal": <number | null>,
    "ts": "<ISO 8601>"
  }
  ```

#### Scenario: complete frame

- **WHEN** the run reaches a terminal state
- **THEN** the frame SHALL be JSON shaped as:

  ```json
  {
    "type": "complete",
    "runId": "<uuid>",
    "status": "succeeded" | "failed" | "trial_complete",
    "startedAt": "<ISO 8601>",
    "completedAt": "<ISO 8601>",
    "recordCount": <number>,
    "tableCount": <number>,
    "attachmentCount": <number>,
    "errorMessage": "<string | null>"
  }
  ```

#### Scenario: error frame (non-terminal)

- **WHEN** a recoverable error occurs (rate limit, transient failure)
- **THEN** the frame SHALL be JSON shaped as:

  ```json
  {
    "type": "error",
    "runId": "<uuid>",
    "errorCode": "<string>",
    "message": "<string>",
    "retryable": <boolean>
  }
  ```
- **AND** the run SHALL remain in `running` state if `retryable` is `true`

#### Scenario: heartbeat frame

- **WHEN** ≥ 15 seconds have elapsed since the last frame of any type
- **THEN** the server SHALL emit:

  ```json
  { "type": "heartbeat", "runId": "<uuid>", "ts": "<ISO 8601>" }
  ```

### Requirement: Heartbeat cadence is 15 seconds

Server SHALL emit a `heartbeat` frame at least every 15 seconds for any open run subscription. Client SHALL treat 30 seconds without any frame as a dead connection and begin reconnecting.

### Requirement: Client reconnect uses exponential backoff capped at 30 seconds

Client reconnect schedule on disconnect: 1s, 2s, 4s, 8s, 16s, 30s. After 30s, every retry is 30s with up to 30s of additional jitter (cap effective wait at 60s). Schedule resets to 1s after a successful frame is received post-reconnect.

#### Scenario: Connection drops after a successful subscription

- **WHEN** the connection drops mid-run
- **THEN** the client SHALL wait 1s before the first reconnect attempt
- **AND** subsequent attempts SHALL follow the 1s, 2s, 4s, 8s, 16s, 30s schedule (jittered)
- **AND** any received frame after a successful reconnect SHALL reset the schedule to 1s for the next disconnect

### Requirement: Server replays last progress + unacknowledged terminal on reconnect

On a successful reconnect, server SHALL emit the most recent `progress` frame (if any) and any `complete`/`error` frame that the client has not acknowledged. Replayed frames SHALL be byte-identical to the original.

#### Scenario: Run completes while client is disconnected

- **WHEN** the server emits `complete` while the client is disconnected
- **AND** the client reconnects within 60 seconds of the `complete` emit
- **THEN** the server SHALL replay the `complete` frame to the reconnecting client
- **AND** the client SHALL render the terminal state once

### Requirement: Frame deduplication is on (runId, type, ts)

Clients SHALL dedupe replayed frames by the triplet `(runId, type, ts)`. Identical replays MUST be idempotent at the rendering layer.

### Requirement: Stub endpoint advertises its spec via response header

While the live token-mint logic is unimplemented, the web stub at `POST /api/me/run-progress-token` SHALL return `501` with header `Spec: openspec/changes/baseout-web-websocket-progress-contract` and body containing `code: 'not_yet_implemented'`.

#### Scenario: Authenticated request to stub returns 501

- **WHEN** an authenticated user `POST`s the endpoint with a valid `runId` body
- **THEN** the response SHALL be `501`
- **AND** header `Spec` SHALL equal `openspec/changes/baseout-web-websocket-progress-contract`
- **AND** the body SHALL be `{ ok: false, code: 'not_yet_implemented', error: 'Token mint is not yet implemented; see Spec header', spec: 'openspec/changes/baseout-web-websocket-progress-contract' }`
