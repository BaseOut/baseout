## ADDED Requirements

### Requirement: OAuth flows owned by front

Front SHALL implement the OAuth/IAM auth flows for Google Drive, Dropbox, Box, OneDrive, S3 (Growth+), Frame.io (Growth+), and BYOS Custom (Pro+). The actual write logic to the destination is owned by `baseout-backup-engine`; front only handles auth + config persistence.

#### Scenario: Dropbox OAuth complete

- **WHEN** a user completes the Dropbox OAuth flow in the wizard
- **THEN** the encrypted tokens are persisted on `storage_destinations` and back can read them at backup time

### Requirement: Folder picker for OAuth destinations

For destinations that have a user-configurable root folder (Google Drive, OneDrive), the OAuth flow SHALL be followed by a folder-picker UI; the chosen folder SHALL be persisted on the `storage_destinations` row.

#### Scenario: Google Drive folder choice

- **WHEN** a user selects "MyBackups/Baseout" in the Google Drive picker
- **THEN** that path is persisted as the destination's `user_root` value

### Requirement: S3 IAM access form

S3 (Growth+) SHALL present an IAM access-key form (key ID + secret + region + bucket + optional prefix) rather than an OAuth flow. The credentials SHALL be encrypted at rest.

#### Scenario: Invalid key submitted

- **WHEN** an S3 form submits credentials that fail a validation `ListBucket` call
- **THEN** the form returns an error and no `storage_destinations` row is persisted

### Requirement: Tier gating

The destination picker SHALL hide or disable destinations the user's tier does not allow (S3 / Frame.io for Growth+, BYOS for Pro+). Tier checks SHALL go through the capability resolver, never hardcoded.

#### Scenario: Starter user

- **WHEN** a Starter user opens the destination picker
- **THEN** R2 / Google Drive / Dropbox / Box / OneDrive are selectable; S3, Frame.io, BYOS are hidden or disabled with a tier hint
