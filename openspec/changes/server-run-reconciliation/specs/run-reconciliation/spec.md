## ADDED Requirements

### Requirement: Stranded runs are terminalized by a reconciliation sweep

The engine SHALL periodically scan `backup_runs` and `restore_runs` in `queued`/`running` older than a grace window (default 15 minutes past `started_at`, or `created_at` when never started), resolve the state of each associated Trigger.dev task, and — when every task is in a terminal state and no completion was recorded — mark the run `failed` with a structured reconciliation reason and a `completed_at` timestamp.

#### Scenario: Tasks expired with no worker connected

- **WHEN** a run's tasks all show EXPIRED in Trigger.dev and the run row is still `running` past the grace window
- **THEN** the sweep marks the run `failed` with an error message naming task expiry, and the UI stops showing an eternally-running backup

#### Scenario: Tasks still executing

- **WHEN** any of the run's tasks is QUEUED or EXECUTING
- **THEN** the sweep leaves the run untouched

#### Scenario: Late completion wins

- **WHEN** `/complete` lands after the sweep selected the run but before its guarded UPDATE commits
- **THEN** exactly one terminal transition happens (the UPDATE is guarded on non-terminal status) and the completion's counts are never overwritten by the sweep

### Requirement: Reconciliation is observable

Each sweep SHALL emit one structured log line with scanned / reconciled / left-alone counts, and each reconciled run's `error_message` SHALL name the observed task states so support can distinguish "no worker" from crashes.

#### Scenario: Quiet sweep

- **WHEN** no stranded runs exist
- **THEN** the sweep logs scanned=N reconciled=0 and writes nothing
