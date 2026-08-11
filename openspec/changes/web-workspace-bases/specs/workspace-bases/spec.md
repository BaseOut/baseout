# workspace-bases

## ADDED Requirements

### Requirement: Bases carry Airtable workspace identity

`at_bases` SHALL carry nullable `workspace_id` and `workspace_name` columns, stamped whenever workspace data is available at persist/rescan/rediscovery time. Absence of workspace data SHALL never block base persistence or listing.

#### Scenario: Rescan stamps workspace identity

- **WHEN** a rescan runs and workspace listing is available for the connection
- **THEN** each reconciled `at_bases` row carries its workspace id and name

#### Scenario: Workspace listing unavailable

- **WHEN** workspace listing fails during a rescan
- **THEN** bases persist/reconcile exactly as today with null workspace columns

### Requirement: Spaces enroll workspaces for auto-add

A `space_workspaces` row SHALL record a Space's enrollment of one Airtable workspace with an `auto_enroll_future_bases` flag and a `last_checked_at` stamp, unique per `(space_id, workspace_id)`, editable via `PUT /api/spaces/[spaceId]/workspaces` with server-side validation. A Space MAY enroll multiple workspaces.

#### Scenario: Enroll two workspaces

- **WHEN** the enrollment API receives two workspaces with auto-add enabled
- **THEN** two `space_workspaces` rows exist for the Space with the flag set

#### Scenario: Un-enroll preserves configured bases

- **WHEN** a workspace's enrollment row is removed
- **THEN** existing `backup_configuration_bases` rows for that workspace's bases are unchanged

### Requirement: A standing flag covers workspaces that do not exist yet

`backup_configurations` SHALL carry an `auto_enroll_new_workspaces` boolean. When true, a workspace newly observed on the connection SHALL be auto-enrolled by the engine as a `space_workspaces` row with `auto_enroll_future_bases = true` and `enrolled_via = 'auto'`. When false, new workspaces SHALL appear un-enrolled. An existing row (any state) SHALL never be modified by the flag.

#### Scenario: New workspace under the standing flag

- **WHEN** the flag is true and a workspace unseen by the Space appears on the connection
- **THEN** an auto-enrolled row is created for it (`enrolled_via='auto'`, auto-add on)

#### Scenario: Explicit opt-out survives

- **WHEN** a user disables auto-add on a previously auto-enrolled workspace and the standing flag remains true
- **THEN** that workspace's row keeps auto-add off on subsequent runs

### Requirement: Legacy auto-add flag yields to workspace rows

When a Space has no `space_workspaces` rows, the existing `backup_configurations.autoAddFutureBases` flag SHALL retain its current connection-wide meaning. When one or more rows exist, the rows SHALL be authoritative and the legacy flag ignored.

#### Scenario: Legacy Space untouched

- **WHEN** a Space has the legacy flag true and no workspace rows
- **THEN** auto-add behavior is unchanged from today (all workspaces)

#### Scenario: Rows take over

- **WHEN** a Space saves workspace enrollment for the first time
- **THEN** subsequent auto-add behavior follows the rows regardless of the legacy flag

### Requirement: The picker can group by workspace

The picker's base-listing payload SHALL include each base's workspace identity, and `GET /api/spaces/[spaceId]/workspaces` SHALL return the connection's workspace list (proxied from the engine). Listing failure SHALL degrade to an ungrouped response, not an error.

#### Scenario: Grouped picker payload

- **WHEN** the picker loads for a connection with workspace data
- **THEN** bases carry `workspaceId`/`workspaceName` and the workspace list endpoint returns the groups
