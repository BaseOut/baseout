## ADDED Requirements

### Requirement: Cleanup-expired-snapshots hourly cron
A Trigger.dev v3 scheduled task `cleanup-expired-snapshots` SHALL run on an hourly cron (`0 * * * *`) and trigger the server-side `runCleanupPass` orchestration via engine-callback.

#### Scenario: cron fires and engine receives pass-trigger
- **WHEN** the hourly cron fires
- **THEN** the task SHALL POST `/api/internal/cleanup/pass-trigger` with `x-internal-token`
- **AND** the server side SHALL execute `runCleanupPass` (which iterates Spaces, decides deletions, calls storage writer + DB)
- **AND** the task body SHALL surface the server-side response as the structured task result

#### Scenario: overlap protection
- **WHEN** a previous invocation is still running when the next cron fire arrives
- **THEN** Trigger.dev v3's scheduled-task semantics SHALL queue the next invocation rather than running concurrently
- **AND** missed fires older than one interval SHALL be dropped per Trigger.dev v3 cron conventions

#### Scenario: engine failure surfaces as task failure
- **WHEN** the engine returns 5xx from `/api/internal/cleanup/pass-trigger`
- **THEN** the task SHALL fail with the upstream status code in the error message
- **AND** SHALL retry per the project's default `retry` policy (max 3 attempts, exponential backoff)
