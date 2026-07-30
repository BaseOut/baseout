## ADDED Requirements

### Requirement: Per-base metadata capture

For each base in a backup run, the `backup-base` task SHALL call `GET /v0/meta/bases/{baseId}` with `include=collaborators`, `include=inviteLinks`, `include=interfaces`, and `include=packages`, immediately after the base-schema fetch and using the same client and per-base rate budget, and SHALL POST the response body verbatim to the engine's `collaborators-sync` internal route as a single per-base capture.

#### Scenario: Successful capture forwarded

- **WHEN** the metadata endpoint returns 200 for a base
- **THEN** the task SHALL POST the unmodified response body to collaborators-sync exactly once for that base in that run

#### Scenario: No task-side parsing

- **WHEN** the payload contains blocks the task does not recognize (e.g. a new include shape)
- **THEN** the capture SHALL still be forwarded verbatim

### Requirement: Best-effort failure isolation

A failed metadata fetch or sync POST SHALL mark the step `collaborators: skipped(reason)` in run progress for that base and SHALL NOT fail, delay, or gate record, attachment, or comment capture.

#### Scenario: Metadata endpoint errors

- **WHEN** the metadata call returns a non-200 for one base
- **THEN** no capture SHALL be posted for that base, the step SHALL be reported skipped with the reason, and the run SHALL continue unaffected
