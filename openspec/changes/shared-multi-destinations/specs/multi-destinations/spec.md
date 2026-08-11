## ADDED Requirements

### Requirement: One storage destination per (Space, provider type)

`storage_destinations` SHALL allow one row per `(space_id, type)` (composite UNIQUE) instead of one per Space. Connecting a provider SHALL upsert only that provider's row and SHALL NOT modify or replace another provider's row for the same Space. Disconnecting a provider SHALL delete only that provider's row.

#### Scenario: Connecting a second provider preserves the first

- **WHEN** a Space has a connected `google_drive` destination and the user completes the Box OAuth flow
- **THEN** the Space has two `storage_destinations` rows (`google_drive` and `box`), and the Drive row's tokens are unchanged

#### Scenario: Disconnect is type-scoped

- **WHEN** a Space has `google_drive` and `box` rows and the user disconnects Box
- **THEN** only the `box` row is deleted

### Requirement: Primary destination is backup_configurations.storage_type

The destination backups write to (the **primary**) SHALL be the one whose `type` equals `backup_configurations.storage_type`. Swapping primary SHALL be a PATCH to backup-config with a `storageType` value; when the value is a BYOS type (`google_drive|box|dropbox|onedrive`) the server SHALL reject with 422 `destination_not_connected` unless a connected `storage_destinations` row exists for that `(space, type)`. Managed types (`r2_managed`, `local_fs`) need no row — the local/managed writers take no per-Space credentials, and the disconnect fallback may set `local_fs` row-lessly.

#### Scenario: Swap primary to a connected destination

- **WHEN** a Space has Drive (primary) and Box connected, and the user sets Box primary
- **THEN** `storage_type` becomes `box` and the next backup writes to Box

#### Scenario: Swap to an unconnected type is rejected

- **WHEN** `storageType='dropbox'` is PATCHed and the Space has no Dropbox row
- **THEN** the API responds 422 `destination_not_connected` and the config is unchanged

### Requirement: Engine creds resolution is type-pinned

`GET /api/internal/spaces/:spaceId/storage-destination` SHALL accept a validated `?type=` parameter and resolve the row by `(space_id, type)`. Workflows SHALL pass the run payload's `storageType` (pinned at enqueue) on the initial read and on `?refresh=1` re-reads, so a mid-run primary swap cannot change a run's credentials. When `?type` is absent, the engine SHALL fall back to `backup_configurations.storage_type`, then to the legacy single-row lookup. An unknown `?type` SHALL yield 400.

#### Scenario: Mid-run primary swap does not affect the running backup

- **WHEN** a backup enqueued with `storageType='google_drive'` is uploading and the user swaps primary to Box, then the task re-fetches creds with `?refresh=1&type=google_drive`
- **THEN** the engine returns refreshed Drive credentials

### Requirement: Disconnecting the primary repoints the config

When the disconnected type equals `storage_type`, the config SHALL repoint to the most-recently-connected remaining destination row; if none remain, to `local_fs`. `storage_type` SHALL never remain pointing at a row-less BYOS type. Disconnecting a non-primary destination SHALL NOT touch the config.

#### Scenario: Primary disconnect falls back to remaining destination

- **WHEN** Drive is primary, Box was connected more recently than Dropbox, and Drive is disconnected
- **THEN** `storage_type` becomes `box`

### Requirement: Connected and primary indicators in the destination UI

The `/destinations/new` provider boxes SHALL show a "Connected" badge on each provider with a connected row. The `/destinations` registry SHALL mark the primary row and offer "Set primary" on connected non-primary rows. A connected provider's screen SHALL offer "Set as primary" (or show "Current primary"), with re-running OAuth demoted to a "Reconnect" action. The wizard's Destination step selection SHALL persist the chosen `storageType` on save. All server round-trips SHALL show a loading state.

#### Scenario: Connected badge on provider boxes

- **WHEN** a Space has Drive and Box connected and the user opens /destinations/new
- **THEN** the Drive and Box boxes show a "Connected" badge and other providers do not

### Requirement: Guarded auto-promotion on first BYOS connect

After a successful OAuth callback for type T, the config SHALL be set to T only when `storage_type` is still `r2_managed` or `local_fs`. An explicitly chosen BYOS primary SHALL never be displaced by connecting another provider.

#### Scenario: First connect becomes primary

- **WHEN** a Space with `storage_type='r2_managed'` completes the Drive OAuth flow
- **THEN** `storage_type` becomes `google_drive`

#### Scenario: Later connect does not steal primary

- **WHEN** a Space with `storage_type='google_drive'` completes the Box OAuth flow
- **THEN** `storage_type` remains `google_drive`
