## ADDED Requirements

### Requirement: A backup verifies Connection auth before it initiates

The engine SHALL verify a `Connection`'s access token is valid — refreshing it on demand if it is at or past expiry — before enqueuing a backup for that Connection, so a scheduled or manual backup never begins against a token that is already dead.

#### Scenario: Access token expired but refresh token still valid

- **WHEN** a backup is requested for a Connection whose access token is past `token_expires_at` and whose refresh token is still valid
- **THEN** the engine refreshes the token in place first and only then enqueues the backup — the run does not start on the expired token

#### Scenario: Refresh token revoked Airtable-side

- **WHEN** a backup is requested for a Connection whose refresh token has been revoked (Airtable returns `invalid_grant`)
- **THEN** the engine does NOT enqueue the backup, transitions the Connection to `pending_reauth`, and surfaces that state instead of failing noisily mid-run
