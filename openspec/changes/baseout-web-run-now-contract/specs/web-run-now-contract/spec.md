## ADDED Requirements

### Requirement: POST /api/internal/runs/start enqueues a backup run

The endpoint SHALL be hosted on both `apps/web` (the orchestrator that creates the `backup_runs` row) and `apps/server` (the worker that transitions the row through its lifecycle). Both implementations MUST accept the same JSON request body and return the same JSON response shapes. The server-hosted endpoint is the live worker; the web-hosted endpoint is the orchestration entry point that web's own UI calls (and that, in turn, calls the server-hosted endpoint over HTTP with the `INTERNAL_TOKEN` header).

#### Scenario: Valid request enqueues a new run

- **WHEN** a request arrives with a valid `x-internal-token` header and a valid JSON body
- **AND** the body's `runId` is not already present in the `backup_runs` table in a non-terminal status
- **THEN** the endpoint SHALL return `202 Accepted`
- **AND** the response body SHALL be `{ ok: true, runId: <runId>, queuedAt: <ISO 8601 timestamp>, idempotent: false }`
- **AND** the corresponding `backup_runs` row SHALL be transitioned from `queued` to `running` (server-hosted endpoint) or remain `queued` until server processes it (web-hosted endpoint)

#### Scenario: Repeat request for an in-flight run is idempotent

- **WHEN** a request arrives with the same `runId` while the existing row is in `running`, `succeeded`, `failed`, or `trial_complete` status
- **THEN** the response SHALL be `200 OK` (not `202`)
- **AND** the body SHALL be `{ ok: true, runId, queuedAt: <existing row's queued timestamp>, idempotent: true }`
- **AND** no new Trigger.dev task SHALL be enqueued

### Requirement: Request body shape is fixed

The request body SHALL be JSON matching the following TypeScript shape:

```ts
{
  runId: string,           // UUID v4; must already exist in backup_runs as 'queued' (web-hosted) or be inserted by server (legacy path; not used)
  spaceId: string,         // UUID; must reference an existing spaces.id
  connectionId: string,    // UUID; must reference an existing connections.id with same organization_id as the space
  triggeredBy: 'manual' | 'scheduled' | 'webhook' | 'trial',
  isTrial: boolean,        // true iff this run consumes the free-trial allowance
  metadata?: Record<string, unknown>  // optional opaque blob; passed through to backup_runs.metadata if present
}
```

#### Scenario: Missing required field returns 400

- **WHEN** the request body omits any of `runId`, `spaceId`, `connectionId`, `triggeredBy`, `isTrial`
- **THEN** the response SHALL be `400 Bad Request`
- **AND** the body SHALL be `{ ok: false, code: 'invalid_body', error: <Zod issue summary> }`

#### Scenario: Unknown triggeredBy value returns 400

- **WHEN** the request body's `triggeredBy` is a string outside the closed enum
- **THEN** the response SHALL be `400 Bad Request`
- **AND** the body's `code` SHALL be `'invalid_body'`

#### Scenario: connectionId belongs to a different organization than spaceId

- **WHEN** the request body's `connectionId.organization_id` differs from the `spaceId.organization_id`
- **THEN** the response SHALL be `403 Forbidden`
- **AND** the body SHALL be `{ ok: false, code: 'forbidden', error: 'Connection does not belong to the target space organization' }`

### Requirement: x-internal-token header is mandatory and validated in constant time

Every call SHALL include an `x-internal-token` header carrying the shared internal-token secret. Validation SHALL use a constant-time comparison to prevent timing attacks.

#### Scenario: Missing header returns 401

- **WHEN** the request omits the `x-internal-token` header
- **THEN** the response SHALL be `401 Unauthorized`
- **AND** the body SHALL be `{ ok: false, code: 'not_authenticated', error: 'Missing internal token' }`

#### Scenario: Wrong header value returns 401 (not 403)

- **WHEN** the `x-internal-token` value does not match the configured secret (constant-time compare)
- **THEN** the response SHALL be `401 Unauthorized` with code `'not_authenticated'`
- **AND** the response SHALL NOT leak any indication of the expected length or any partial match

### Requirement: Web pre-creates the backup_runs row before calling server

When `apps/web` is the caller (i.e., the user clicked "Run Now" or scheduled trigger fired), web SHALL insert a `backup_runs` row in `status='queued'` BEFORE issuing the HTTP request to `apps/server`. The inserted `runId` becomes the request body's `runId`.

#### Scenario: HTTP call to server fails after row insert

- **WHEN** web has inserted the row but the HTTP call to `apps/server` returns 5xx, times out, or throws a network error
- **THEN** web SHALL transition the row to `status='failed'` with `error_message` describing the transport failure
- **AND** web SHOULD NOT retry automatically (the user / scheduler decides whether to re-trigger)

### Requirement: Stub endpoint advertises its spec via response header

While `apps/server` engine-core is unimplemented, the web-hosted stub at `POST /api/internal/runs/start` SHALL return `501 Not Implemented` with header `Spec: openspec/changes/baseout-web-run-now-contract`. The response body SHALL include `code: 'not_yet_implemented'` and a `spec` field carrying the same path.

#### Scenario: Live request to the stub succeeds the validation gates and returns 501

- **WHEN** a valid token + valid body request hits the stub
- **THEN** the response SHALL be `501`
- **AND** the body SHALL be `{ ok: false, code: 'not_yet_implemented', error: 'Run enqueue is not yet implemented; see Spec header', spec: 'openspec/changes/baseout-web-run-now-contract' }`
- **AND** the response SHALL include header `Spec: openspec/changes/baseout-web-run-now-contract`

### Requirement: Error code enum is closed

Failure responses SHALL use one of the following machine-readable codes; new codes require a v2 contract.

| Code | HTTP | Meaning |
|---|---|---|
| `not_authenticated` | 401 | Missing or invalid `x-internal-token`. |
| `forbidden` | 403 | Token valid but caller is not authorized for this resource (e.g., cross-org `connectionId`). |
| `invalid_body` | 400 | Body fails Zod validation. |
| `conflict` | 409 | `runId` already exists in a terminal state with mismatched `triggeredBy`. |
| `not_yet_implemented` | 501 | Stub response while engine-core is unbuilt. |
| `internal_error` | 500 | Unhandled exception. Body's `error` SHOULD NOT leak stack traces. |
