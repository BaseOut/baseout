## ADDED Requirements

### Requirement: StorageWriter interface

The engine SHALL define a common `StorageWriter` interface implemented by every destination strategy with the methods `init`, `writeFile(stream, path)`, `getDownloadUrl(path)`, and `delete(path)`. Each backup run SHALL select a strategy by reading `storage_destinations` for the Space.

#### Scenario: Strategy selection

- **WHEN** a backup run starts for a Space whose `storage_destinations.type='dropbox'`
- **THEN** the engine instantiates the Dropbox `StorageWriter` and routes all writes through it

### Requirement: Supported destinations

The engine SHALL implement strategies for Cloudflare R2 (managed, all tiers), Google Drive (OAuth, all tiers), Dropbox (OAuth + proxy stream, all tiers), Box (OAuth + proxy stream, all tiers), OneDrive (OAuth, all tiers), Amazon S3 (IAM / access key, Growth+), Frame.io (OAuth, Growth+), and Custom/BYOS (Pro+).

#### Scenario: Tier-gated destination

- **WHEN** a Starter Space attempts to add an S3 destination
- **THEN** the `web`-side validation rejects it; if it slips past, the engine refuses to use it and marks the run failed with reason `tier_not_eligible_destination`

### Requirement: Proxy streaming for Box and Dropbox

For destinations that require proxy streaming (Box, Dropbox), the strategy SHALL pipe the source stream through Worker memory to the destination without buffering the full file to disk or R2.

#### Scenario: Large attachment to Dropbox

- **WHEN** an attachment >100 MB is uploaded to a Dropbox destination
- **THEN** it streams chunk-by-chunk from the Airtable URL through the Worker to Dropbox without intermediate storage

### Requirement: Encryption disclosure

Backup data on R2 SHALL be encrypted at rest using Cloudflare's server-side encryption. Customer destinations rely on the provider's at-rest encryption, which SHALL be disclosed in product docs.

#### Scenario: Default R2 encryption

- **WHEN** a backup writes to managed R2
- **THEN** the file is server-side encrypted by Cloudflare without additional engine action

### Requirement: OAuth handoff from front

Front initiates the OAuth/IAM auth flow for each destination during the onboarding wizard. The engine SHALL read the persisted credentials from `storage_destinations` (encrypted) and SHALL NOT initiate auth flows itself.

#### Scenario: Token expired mid-run

- **WHEN** the destination OAuth token expires during a run
- **THEN** the engine triggers the OAuth refresh path (background service §oauth-token-refresh) and retries the in-flight write
