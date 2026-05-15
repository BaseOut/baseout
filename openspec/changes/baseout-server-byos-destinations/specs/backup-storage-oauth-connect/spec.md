## ADDED Requirements

### Requirement: Per-provider OAuth authorize + callback routes

For each OAuth-based provider (`google_drive`, `dropbox`, `box`, `onedrive`, `frame_io`), `apps/web` SHALL expose:

- `GET /api/connections/storage/<provider>/authorize?spaceId=<uuid>` — initiates the flow.
- `GET /api/connections/storage/<provider>/callback?code=<>&state=<>` — completes the flow.

Each authorize route SHALL persist a `state` token in `oauth_states` (or set a signed cookie) keyed to the user + spaceId. The callback SHALL reject any callback whose `state` is missing, expired (> 10 minutes old), or does not match the current user.

#### Scenario: Replay of an old state

- **WHEN** a callback arrives with a `state` value whose `oauth_states` row is > 10 minutes old
- **THEN** the route SHALL return 400 `{ error: 'oauth_state_expired' }` and SHALL NOT exchange the code

#### Scenario: State mismatch

- **WHEN** a callback's `state` value is valid but belongs to a different user than the current session
- **THEN** the route SHALL return 403 `{ error: 'oauth_state_user_mismatch' }`

### Requirement: Encrypted token persistence

After a successful token exchange, the callback route SHALL encrypt the access + refresh tokens with the master key using the AES-256-GCM helper from `@baseout/shared`, and UPSERT the resulting ciphertext into `storage_destinations.oauth_access_token_enc` and `storage_destinations.oauth_refresh_token_enc`. Plaintext tokens SHALL NOT be persisted, logged, or returned to the client.

#### Scenario: Tokens encrypted at rest

- **WHEN** a Google Drive OAuth callback succeeds and writes to `storage_destinations`
- **THEN** the row's `oauth_access_token_enc` and `oauth_refresh_token_enc` columns SHALL contain ciphertext (no detectable plaintext patterns) and the audit log SHALL NOT contain the plaintext tokens

### Requirement: S3 IAM-keys form

The S3 connect path SHALL be a `POST /api/connections/storage/s3/configure` route accepting `{ accessKeyId, secretAccessKey, region, bucket, prefix? }`. The route SHALL validate connectivity via a `HeadBucket` probe before persisting the credentials. Persisted credentials SHALL be encrypted using the same AES-256-GCM helper.

#### Scenario: HeadBucket fails

- **WHEN** the user submits S3 credentials and `HeadBucket` returns 403 (NoSuchBucket or AccessDenied)
- **THEN** the route SHALL return 400 `{ error: 's3_credentials_invalid' }` and SHALL NOT persist the credentials

### Requirement: Tier-gated destination

The `PATCH /api/spaces/:id/backup-config` route SHALL reject any `storageType` value not in `resolveStorageDestinations(tier).allowedTypes` for the current Org's tier.

#### Scenario: Launch tries S3

- **WHEN** a Launch Space PATCHes `storageType='s3'`
- **THEN** the route SHALL return 400 `{ error: 'storage_type_not_available_at_tier', allowedTypes: [...] }`
