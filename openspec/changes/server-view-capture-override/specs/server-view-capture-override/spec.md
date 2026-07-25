## ADDED Requirements

### Requirement: View-capture env override

When the engine Worker's `VIEW_CAPTURE_OVERRIDE` environment variable is exactly `"1"`, `/api/internal/spaces/:spaceId/schema-sync` SHALL treat the run's connection as view-capture-enabled without resolving `connections.platform_config`, and the response's `viewCapture` field SHALL be the string `"override"`. When the variable is unset or any other value, gate resolution SHALL be unchanged (`is_enterprise_scope === true`, default closed) and `viewCapture` SHALL remain `true`/`false`.

#### Scenario: Dev Worker captures views for a non-Enterprise connection

- **WHEN** `VIEW_CAPTURE_OVERRIDE=1` is set and a schema-sync runs for a run whose connection lacks `enterprise.*` scopes
- **THEN** captured views are diffed and persisted to `bo_at_views` exactly as for an Enterprise connection, and the response carries `viewCapture: "override"`

#### Scenario: Unset variable leaves the gate closed

- **WHEN** the variable is absent and the connection is not Enterprise-scoped
- **THEN** views are stripped before hash/diff/store and the response carries `viewCapture: false`

### Requirement: Gated syncs sweep stale-active view rows to unknown

When a schema-sync resolves with view capture closed, the engine SHALL set `status='unknown'` on the synced base's `bo_at_views` rows that are currently `status='active'`, inside the same transaction as the schema diff apply. Rows with any other status SHALL NOT be modified, and `first_unseen_run` SHALL NOT be stamped (the `unknown` state is not a confident removal).

#### Scenario: Pre-gate rows converge on the first gated sync

- **WHEN** a base holds `active` view rows captured before the §8.2 gate existed and a gated sync runs
- **THEN** those rows become `status='unknown'` and the sync succeeds normally

#### Scenario: Idempotent on repeat

- **WHEN** a second gated sync runs for the same base
- **THEN** the sweep matches zero rows and nothing changes

#### Scenario: Reappearance on a later gate-open sync

- **WHEN** the gate later resolves open (Enterprise reconnect or override) and the capture includes a view whose row is `unknown`
- **THEN** the standard insert/seen upsert returns the row to `status='active'` with `last_seen_run` stamped
