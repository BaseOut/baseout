# workspace-listing-and-auto-enroll

## ADDED Requirements

### Requirement: The engine lists a connection's workspaces via MCP

The engine SHALL expose an INTERNAL_TOKEN-gated route `GET /api/internal/connections/:connectionId/workspaces` that calls the Airtable MCP workspace-listing tool with the Connection's OAuth token and returns the normalized workspace list, served through a short-TTL per-connection cache. MCP failure SHALL return a distinguishable degraded response, not a 5xx.

#### Scenario: Picker fetch

- **WHEN** web requests a connection's workspaces via the service binding
- **THEN** the route returns the workspace list, and a repeat within the TTL is served from cache without a second MCP call

#### Scenario: MCP unavailable

- **WHEN** the MCP call fails
- **THEN** the route responds with a degraded (empty-with-reason) payload and web can fall back to an ungrouped picker

### Requirement: Rediscovery stamps workspace identity onto bases

`runWorkspaceRediscovery` SHALL stamp `at_bases.workspace_id`/`workspace_name` during its reconcile whenever workspace listing succeeds, and SHALL proceed unchanged when it fails.

#### Scenario: Reconcile with workspace data

- **WHEN** rediscovery runs and the workspace listing succeeds
- **THEN** reconciled bases carry workspace identity

### Requirement: Enrolled workspaces auto-add new bases at run start

Before assembling a run's base list, for a Space with auto-enroll enrollment (workspace rows, or the legacy flag when no rows exist), the engine SHALL fetch the enrolled workspaces' current bases, add bases not yet configured (`at_bases` insert if unknown; `backup_configuration_bases` with `isIncluded = true, isAutoDiscovered = true`) up to the Space's bases-per-Space cap, stamp `space_workspaces.last_checked_at`, include the added bases in the starting run, and emit a notification. Bases beyond the cap SHALL be skipped with a distinct plan-limit notification and re-considered on subsequent runs.

#### Scenario: New base since last run

- **WHEN** a run starts for a Space enrolled in workspace W and W contains one base not in the Space's configuration
- **THEN** the base is added as included + auto-discovered, backed up in that same run, and an added-bases notification is emitted

#### Scenario: Cap reached

- **WHEN** two new bases are found but only one slot remains under the tier cap
- **THEN** one base is added and run, the other is skipped, and a plan-limit notification names the workspace

#### Scenario: Un-enrolled workspace is ignored

- **WHEN** a new base appears in a workspace the Space has not enrolled and the standing new-workspaces flag is false
- **THEN** no base is added

### Requirement: New workspaces are auto-enrolled under the standing flag

When `auto_enroll_new_workspaces` is true and the run-start listing contains a workspace with no `space_workspaces` row for the Space, the engine SHALL create an auto-enrolled row (`enrolled_via='auto'`, `auto_enroll_future_bases=true`), emit a new-workspace notification, and process that workspace's bases in the same run's base check. Existing rows SHALL never be modified by the flag.

#### Scenario: Company adds a workspace

- **WHEN** a run starts for a Space with the standing flag on and the listing shows a never-seen workspace containing two bases
- **THEN** the workspace is enrolled automatically, both bases are added (cap permitting) and backed up in that run, and notifications record the new workspace and added bases

#### Scenario: Standing flag off

- **WHEN** the standing flag is false and a never-seen workspace appears
- **THEN** no enrollment row is created and none of its bases are added

### Requirement: The auto-enroll check never compromises the run

Any failure in the workspace fetch or add-path SHALL skip the check with a recorded reason and start the run on the already-configured base set, with no change to run outcome semantics.

#### Scenario: MCP outage at run start

- **WHEN** the workspace listing fails as a run starts
- **THEN** the run proceeds normally on configured bases and the skip reason is recorded
