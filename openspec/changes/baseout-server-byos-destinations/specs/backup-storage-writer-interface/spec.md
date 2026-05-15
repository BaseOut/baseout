## ADDED Requirements

### Requirement: Common StorageWriter interface

The engine SHALL define a `StorageWriter` interface at `apps/server/src/lib/storage/storage-writer.ts` with methods `init`, `writeFile`, `getDownloadUrl`, `delete`, plus an optional boolean `proxyStreamMode`. Every destination strategy SHALL implement the full interface.

#### Scenario: Strategy dispatch

- **WHEN** `makeStorageWriter(dest, env, masterKey)` is called with `dest.type='google_drive'`
- **THEN** the factory SHALL return an instance of `GoogleDriveWriter` constructed with the decrypted tokens and the configured `provider_folder_id`

#### Scenario: Unknown type rejected

- **WHEN** `makeStorageWriter` is called with an unrecognised `type`
- **THEN** the factory SHALL throw a structured error and SHALL NOT silently fall back to managed R2

### Requirement: Proxy-stream mode for Box and Dropbox

`BoxWriter` and `DropboxWriter` SHALL expose `proxyStreamMode=true`. When the per-base task observes `writer.proxyStreamMode === true`, it SHALL pipe Airtable's response stream directly through `writer.writeFile` without staging the bytes in managed R2 first.

#### Scenario: Large attachment to Dropbox

- **WHEN** an attachment > 100 MB is written to a Dropbox destination
- **THEN** the engine SHALL stream chunk-by-chunk from Airtable's CDN through the Worker to Dropbox without writing to R2

### Requirement: Token refresh on init

OAuth-based strategies (Google Drive, Dropbox, Box, OneDrive, Frame.io) SHALL call `refreshTokenIfNearExpiry` inside `init()` and SHALL retry once on a 401 response from the provider during `writeFile`. Tokens SHALL be re-encrypted and persisted on every successful refresh.

#### Scenario: Token expired mid-write

- **WHEN** Google Drive returns 401 during a `writeFile` upload
- **THEN** the strategy SHALL refresh the access token via the Google `/token` endpoint, persist the new token + expiry to `storage_destinations`, and retry the upload exactly once

### Requirement: BYOS retention is customer-owned

The retention engine SHALL call `writer.delete(path)` only for destinations of `type='r2_managed'`. For BYOS destinations, the retention engine SHALL set `backup_runs.deleted_at` but SHALL NOT issue a delete call to the customer's storage.

#### Scenario: Retention pass on BYOS Space

- **WHEN** the retention engine processes a Space whose `storage_destinations.type='google_drive'` with expired runs
- **THEN** the engine SHALL set `backup_runs.deleted_at = now()` for the expired runs and SHALL skip the destination-side delete
