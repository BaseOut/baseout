## ADDED Requirements

### Requirement: Layout and navigation

The dashboard SHALL include a Space selector (defaults to last-viewed per user) and the navigation sections: Backups, Schema, Data, Automations, Interfaces, AI, Analytics, Governance, Integrations, Settings.

#### Scenario: Last-viewed Space restored

- **WHEN** a user with multiple Spaces logs back in
- **THEN** the dashboard opens to the last Space they viewed

### Requirement: Top-level cards

The dashboard's top section SHALL render: Current Backup Status (live WebSocket if running, last result if idle), Backup History (most recent N runs with status / timestamp / counts), Storage Usage (R2 + DB usage vs. tier limit; link to upgrade), Notifications / Action Items (failures, schema changes, health alerts), Health Score per Base.

#### Scenario: No active run

- **WHEN** no backup is currently running for the Space
- **THEN** Current Backup Status shows the most recent `backup_runs` outcome with timestamp and counts

### Requirement: WebSocket live progress client

`baseout-web` SHALL open a WebSocket to `wss://{BACKUP_ENGINE_URL}/spaces/{space_id}/progress` when a backup is active and SHALL render the structured events emitted by `baseout-backup`'s per-Space DO. The client SHALL auto-reconnect with backoff and resume from the last received state on reconnection.

#### Scenario: Connection drops mid-run

- **WHEN** the WebSocket disconnects during a run
- **THEN** the client auto-reconnects, resubscribes, and resumes rendering from the next event without losing UI state

### Requirement: Event handling per cross-service contract

The client SHALL handle exactly the events `run_started`, `base_started`, `progress_pct`, `base_completed`, `run_completed`, and `error` per the cross-service contract. `baseout-web` SHALL NOT invent new event types.

#### Scenario: Unknown event

- **WHEN** an unknown event arrives
- **THEN** it is logged but ignored without breaking the UI

### Requirement: Storage usage source

Storage Usage cards SHALL read R2 usage and DB usage from the cached `space_databases` size column rather than calling Cloudflare or a DB live each render.

#### Scenario: Cache stale

- **WHEN** `space_databases` size is more than 1 hour stale
- **THEN** the dashboard shows the cached value with a "last updated" timestamp; freshness is the `baseout-backup`'s responsibility
