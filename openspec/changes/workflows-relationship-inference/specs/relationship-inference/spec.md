# relationship-inference

A per-run Trigger.dev task that triggers engine-side synced-view inference for
each base in a backup run.

## ADDED Requirements

### Requirement: Per-base inference trigger with isolation
The task SHALL POST the engine `/relationships/sync` once per base in the run and
aggregate the upsert results. A failure for one base SHALL NOT abort the others;
failures SHALL be collected and reported. Engine `409`/`501` (space DB not ready /
not managed_pg) SHALL degrade to a no-op rather than an error.

#### Scenario: Fan out across a run's bases
- **WHEN** the task runs for a run covering several bases
- **THEN** it triggers inference once per base and returns the aggregated counts

#### Scenario: One base fails
- **WHEN** the engine errors for one base
- **THEN** the remaining bases still process and the error is recorded for that base

#### Scenario: Space DB not ready
- **WHEN** the engine returns 409 or 501 for a base
- **THEN** that base contributes a zero result (no thrown error)
