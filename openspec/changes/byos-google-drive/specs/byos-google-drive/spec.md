## ADDED Requirements

### Requirement: storage_destinations table persists per-Space BYOS configuration

A `storage_destinations` table SHALL exist in the master DB schema. Each row represents one cloud storage destination configured for one Space. Tokens and credentials SHALL be encrypted at rest using AES-256-GCM with `env.BASEOUT_ENCRYPTION_KEY` per PRD §20.2.

The table SHALL have, at minimum, these columns: `id uuid PK`, `space_id uuid NOT NULL FK→spaces.id ON DELETE CASCADE`, `destination_type text NOT NULL`, `display_name text NOT NULL`, `is_default boolean NOT NULL DEFAULT false`, `access_token_enc text NULL`, `refresh_token_enc text NULL`, `token_expires_at timestamptz NULL`, `config_json jsonb NULL`, `status text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `modified_at timestamptz NOT NULL DEFAULT now()`. The table SHALL declare `UNIQUE (space_id)` for V1 (one destination per Space).

The `destination_type` column SHALL be CHECK-constrained to the set of providers shipped in the current product release. In this change the set is `{'google_drive'}`; future provider changes widen the CHECK.

The `status` column SHALL be CHECK-constrained to `{'active', 'invalid', 'pending_auth'}`.

#### Scenario: Drive Connect persists an encrypted row

- **WHEN** a user completes the Google Drive OAuth Connect flow for a Space
- **THEN** a `storage_destinations` row SHALL exist with `space_id` equal to the active Space, `destination_type = 'google_drive'`, `status = 'active'`, `access_token_enc` and `refresh_token_enc` non-null and AES-256-GCM-encrypted, `token_expires_at` set to the Google-provided expiry, `config_json.folder_id` set to the per-Space Drive folder ID, `config_json.folder_name` set to `Baseout-<spaceId>`, and `config_json.account_email` set to the Google account email returned from `userinfo`

#### Scenario: Disconnect deletes the row

- **WHEN** a user posts to `/api/connections/storage/google-drive/disconnect` for the active Space
- **THEN** the `storage_destinations` row for that Space SHALL be deleted
- **AND** the Drive folder in the user's Google Drive SHALL remain intact (Baseout does not delete user data on disconnect)

#### Scenario: Re-Connect upserts and preserves the refresh token when Google omits it

- **WHEN** a user re-Connects Google Drive for a Space that already has a `storage_destinations` row
- **AND** the Google callback response includes an `access_token` but no `refresh_token` (Google's "already-consented" quirk)
- **THEN** the existing `refresh_token_enc` SHALL be preserved
- **AND** `access_token_enc` and `token_expires_at` SHALL be overwritten with the new values
- **AND** `status` SHALL be set to `'active'`

#### Scenario: CASCADE delete on Space removal

- **WHEN** a Space is deleted
- **THEN** all `storage_destinations` rows for that Space SHALL be deleted automatically via the FK CASCADE

---

### Requirement: oauth_states table provides a CSRF/PKCE handoff fallback

An `oauth_states` table SHALL exist in the master DB schema as a fallback for the sealed-cookie PKCE handoff. The cookie is primary; the table is used only when the cookie is absent on the callback (cross-site cookie edge cases).

The table SHALL have, at minimum, these columns: `state text PK`, `space_id uuid NOT NULL FK→spaces.id ON DELETE CASCADE`, `code_verifier_enc text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`. The `created_at` column SHALL be indexed for periodic purge.

Rows SHALL be treated as expired after 10 minutes. Expired rows MAY be purged by a future scheduled job; expired rows MUST be rejected by the callback handler regardless of presence.

#### Scenario: Callback rejects an expired state

- **WHEN** a callback arrives with a `state` value matching an `oauth_states` row whose `created_at` is older than 10 minutes
- **THEN** the callback SHALL respond with HTTP `400` and the body SHALL indicate `expired_state`
- **AND** no `storage_destinations` row SHALL be persisted

---

### Requirement: Google Drive Connect uses PKCE-S256 with pinned scopes

The Google Drive OAuth Connect flow SHALL use OAuth 2.0 Authorization Code with PKCE (S256 challenge method). It SHALL request exactly these three scopes and no others: `profile`, `https://www.googleapis.com/auth/drive.file`, `https://www.googleapis.com/auth/drive.appdata`.

The authorize URL SHALL include `access_type=offline` and `prompt=consent` so that Google returns a refresh token on first consent.

The redirect URI SHALL be `https://baseout.local:4331/api/connections/storage/google-drive/callback` in dev and `https://console.baseout.dev/api/connections/storage/google-drive/callback` in production. The path component is identical across environments.

#### Scenario: Authorize redirects to Google consent

- **WHEN** an authenticated user `POST`s to `/api/connections/storage/google-drive/authorize` for the active Space
- **THEN** the response SHALL be HTTP `303` (or `302`) with a `Location` header pointing at `https://accounts.google.com/o/oauth2/v2/auth?...`
- **AND** the `Location` query string SHALL contain `client_id`, `redirect_uri`, `response_type=code`, `scope` containing exactly the three pinned scopes, `code_challenge`, `code_challenge_method=S256`, `state`, `access_type=offline`, and `prompt=consent`
- **AND** a sealed handoff cookie SHALL be set on the response, encrypting the PKCE `code_verifier` and the `state` value with `BASEOUT_ENCRYPTION_KEY`

#### Scenario: Authorize rejects unauthenticated requests

- **WHEN** a `POST /api/connections/storage/google-drive/authorize` request arrives without a valid session cookie
- **THEN** the response SHALL be HTTP `401` or a redirect to `/login`, matching the existing middleware policy for non-public mutating routes

---

### Requirement: Google Drive callback exchanges code, creates per-Space folder, and upserts the row

The callback handler at `GET /oauth/callback/google` SHALL:

1. Read the sealed handoff cookie (or fall back to the `oauth_states` row keyed by `state` when the cookie is absent).
2. Reject the request when `state` does not match (HTTP `400`).
3. Exchange the authorization `code` for tokens at `https://oauth2.googleapis.com/token` using the PKCE `code_verifier`.
4. Call `https://www.googleapis.com/oauth2/v3/userinfo` to retrieve the user's email.
5. Call `POST https://www.googleapis.com/drive/v3/files` to create a folder named `Baseout-<spaceId>` with `mimeType: application/vnd.google-apps.folder` and `parents: ['root']`.
6. Upsert a `storage_destinations` row for the active Space with the encrypted tokens, the returned folder ID, and the user's email.
7. Redirect the browser to `/integrations?connected=google_drive`.

#### Scenario: Google returns an error

- **WHEN** the callback's `state` is valid but Google returned `?error=access_denied`
- **THEN** the handler SHALL redirect to `/integrations?error=access_denied`
- **AND** no `storage_destinations` row SHALL be persisted

#### Scenario: Token exchange fails

- **WHEN** the `POST` to `https://oauth2.googleapis.com/token` returns non-2xx
- **THEN** the handler SHALL redirect to `/integrations?error=token_exchange_failed`
- **AND** no `storage_destinations` row SHALL be persisted
- **AND** the error response body SHALL be logged via the structured logger (NOT `console.*`) for debugging

#### Scenario: Folder creation fails

- **WHEN** `POST https://www.googleapis.com/drive/v3/files` returns non-2xx
- **THEN** the handler SHALL redirect to `/integrations?error=folder_create_failed`
- **AND** no `storage_destinations` row SHALL be persisted

---

### Requirement: StoragePicker exposes Drive Connect / Connected state

The `StoragePicker.astro` component SHALL render a "Connect Google Drive" button when no `storage_destinations` row exists for the active Space, and `Connected as <email>` plus a "Disconnect" control when a row with `status = 'active'` exists for the active Space.

The Connect button SHALL `POST` to `/api/connections/storage/google-drive/authorize` and SHALL use `setButtonLoading` from [`apps/web/src/lib/ui.ts`](../../../../apps/web/src/lib/ui.ts) per CLAUDE.md §4.5.

The Disconnect control SHALL `POST` to `/api/connections/storage/google-drive/disconnect` and SHALL use `setButtonLoading` for the duration of the request.

#### Scenario: No row exists for the Space

- **WHEN** the StoragePicker renders for a Space with no `storage_destinations` row
- **THEN** the picker SHALL show a "Connect Google Drive" button
- **AND** no email or folder name SHALL be displayed

#### Scenario: Active row exists

- **WHEN** the StoragePicker renders for a Space whose `storage_destinations` row has `status = 'active'` and `destination_type = 'google_drive'`
- **THEN** the picker SHALL show `Connected as <config_json.account_email>` and the folder name `<config_json.folder_name>`
- **AND** the picker SHALL show a Disconnect control

#### Scenario: Pending re-auth

- **WHEN** the row's `status` is `'pending_auth'`
- **THEN** the picker SHALL show a "Re-connect Google Drive" prompt with the original account email displayed for context

---

### Requirement: Engine internal credential route returns refreshed Drive tokens

A route SHALL exist at `GET /api/internal/spaces/{spaceId}/storage-destination` on `apps/server`, gated by the `x-internal-token` header matching `INTERNAL_TOKEN`. It SHALL return JSON shaped `{ destinationType, accessToken, expiresAt, config: { folderId, folderName } }` for the active destination of the given Space.

The handler SHALL refresh the access token against `https://oauth2.googleapis.com/token` when `token_expires_at` is within 5 minutes of `now()`, OR when the query string includes `refresh=1`. On successful refresh, the handler SHALL persist the new `access_token_enc` and `token_expires_at` to the `storage_destinations` row.

The handler MUST NOT return the refresh token to the caller.

The handler SHALL behave per the `DriveRefreshOutcome` discriminated union when refresh fails: `pending_reauth` flips `status = 'pending_auth'` and returns HTTP `409`; `transient` returns HTTP `503` with a `Retry-After` header; `invalid` returns HTTP `502` with a typed reason in the body.

#### Scenario: Token is fresh

- **WHEN** an internal-token request arrives and `token_expires_at` is more than 5 minutes from now
- **THEN** the handler SHALL return `200` with the current `access_token` and the existing `expires_at`
- **AND** no row update SHALL occur

#### Scenario: Token is near-expiry

- **WHEN** `token_expires_at` is less than 5 minutes from now
- **THEN** the handler SHALL refresh against Google and return `200` with the new `access_token` and new `expires_at`
- **AND** the row SHALL be updated with `access_token_enc` and `token_expires_at` set to the refreshed values

#### Scenario: Forced refresh

- **WHEN** the request includes `?refresh=1`
- **THEN** the handler SHALL refresh regardless of `token_expires_at`

#### Scenario: Refresh returns invalid_grant

- **WHEN** the Google token-refresh response is `400` with `error=invalid_grant`
- **THEN** the row's `status` SHALL be set to `'pending_auth'`
- **AND** the handler SHALL return `409` with body `{ kind: 'pending_reauth', reason: 'invalid_grant' }`

#### Scenario: Missing internal token

- **WHEN** an `/api/internal/spaces/{spaceId}/storage-destination` request arrives without `x-internal-token` matching `env.INTERNAL_TOKEN`
- **THEN** the handler SHALL return `401`

#### Scenario: No destination configured

- **WHEN** an internal-token request arrives for a Space with no `storage_destinations` row
- **THEN** the handler SHALL return `404` with body `{ error: 'no_destination' }`

---

### Requirement: Workflows Google Drive writer uploads via resumable session and refreshes on 401

The `apps/workflows` Google Drive writer SHALL implement the `StorageWriter` interface (`init`, `writeFile(stream, path)`, `getDownloadUrl(path)`, `delete(path)`, `deletePrefix(prefix)`).

Uploads SHALL use Drive v3 resumable upload (`POST /upload/drive/v3/files?uploadType=resumable` followed by `PUT <session-uri>` with the stream body). Simple single-shot upload MUST NOT be used.

The writer SHALL guard against path traversal by rejecting any `path` argument containing `..` segments or starting with `/`.

The writer SHALL perform proactive token refresh by re-fetching credentials from the engine internal route when the in-memory `expiresAt` is less than 5 minutes from now.

The writer SHALL perform reactive refresh on a single `401` response: refetch credentials from the engine with `?refresh=1`, retry the original request once, and fail the run if a second `401` occurs.

The writer SHALL maintain a per-instance sub-folder cache to avoid re-querying Drive for the same backup-run folder on every `writeFile`.

`deletePrefix(prefix)` SHALL resolve `prefix` to a Drive folder ID within the per-Space root and SHALL issue `DELETE /drive/v3/files/{folderId}`. Drive recursively deletes folder contents — no per-file enumeration is required.

#### Scenario: Successful upload

- **WHEN** `writeFile(stream, 'runs/<runId>/users.csv')` is called with valid creds
- **THEN** the writer SHALL `POST` to `/upload/drive/v3/files?uploadType=resumable` with the file metadata
- **AND** SHALL `PUT` the stream to the `Location` header value returned by Drive
- **AND** the resulting file SHALL exist in the Drive folder identified by `config.folderId`

#### Scenario: Path traversal rejected

- **WHEN** `writeFile(stream, '../../escape.csv')` is called
- **THEN** the writer SHALL throw an error before issuing any HTTP request to Drive
- **AND** the error SHALL be typed as `StorageWriterError` with `kind: 'invalid_path'`

#### Scenario: Reactive 401 retry

- **WHEN** an upload `PUT` returns `401`
- **THEN** the writer SHALL refetch credentials from the engine with `?refresh=1`
- **AND** SHALL retry the `PUT` exactly once
- **AND** SHALL fail the run with `kind: 'auth_failed'` if the retry also returns `401`

#### Scenario: deletePrefix removes a backup-run folder

- **WHEN** `deletePrefix('runs/<runId>')` is called and a sub-folder named `runs/<runId>` exists under `config.folderId`
- **THEN** the writer SHALL `DELETE /drive/v3/files/<subFolderId>`
- **AND** the deletion SHALL be idempotent: a second call for the same prefix SHALL succeed without error even if the folder no longer exists

---

### Requirement: backup-base.task selects the Drive writer when storageType is google_drive

The [`apps/workflows/trigger/tasks/backup-base.task.ts`](../../../../apps/workflows/trigger/tasks/) entry point SHALL select the storage writer for each run by reading `payload.storageType`. When `storageType === 'google_drive'`, the task SHALL fetch credentials from the engine internal route at `GET /api/internal/spaces/{spaceId}/storage-destination` and SHALL instantiate the Google Drive writer with those credentials and a `refresh()` closure that re-hits the same route with `?refresh=1`.

When `storageType === 'local_fs'`, the task SHALL continue using the existing local-filesystem writer.

Unknown `storageType` values SHALL cause the task to fail with a typed error before any data is read from Airtable.

#### Scenario: Drive run

- **WHEN** a backup-base task starts with `payload.storageType = 'google_drive'`
- **THEN** the task SHALL `GET` `/api/internal/spaces/{spaceId}/storage-destination`
- **AND** SHALL instantiate `GoogleDriveWriter` with the returned credentials
- **AND** SHALL write all CSVs to the writer
- **AND** the engine route SHALL NOT be re-called within the same run except via the `refresh()` closure on 401

#### Scenario: Local-fs run unchanged

- **WHEN** a backup-base task starts with `payload.storageType = 'local_fs'`
- **THEN** the task SHALL NOT call the engine internal credential route
- **AND** SHALL use the existing local-filesystem writer behavior

#### Scenario: Unknown storage type

- **WHEN** a backup-base task starts with `payload.storageType = 'unknown_provider'`
- **THEN** the task SHALL fail with a typed error before fetching any Airtable data
- **AND** the backup run row SHALL be marked failed with reason `unsupported_storage_type`

---

### Requirement: persist-policy widens accept-list to include google_drive

The [`apps/web/src/lib/backup-config/persist-policy.ts`](../../../../apps/web/src/lib/backup-config/) accept-list for valid `storage_type` values SHALL be `{'local_fs', 'google_drive'}` after this change. Any other value SHALL be rejected by the validator.

#### Scenario: Drive accepted

- **WHEN** a backup-config save request submits `storage_type = 'google_drive'`
- **THEN** the policy SHALL accept the value and persist the config

#### Scenario: Unknown rejected

- **WHEN** a backup-config save request submits `storage_type = 'dropbox'` (not yet shipped)
- **THEN** the policy SHALL reject the value with a typed error

---

### Requirement: Airtable Connection capability is unchanged

This change SHALL NOT modify any file under `apps/web/src/lib/airtable/` or `apps/web/src/pages/api/connections/airtable/`. Edits to `apps/web/src/lib/integrations.ts` and `apps/web/src/stores/connections.ts` SHALL be additive only — no existing field of `IntegrationsState` may be removed, renamed, or re-typed.

After every phase of this change is implemented and merged, the Airtable Connect flow, the Airtable token-refresh path, and the rendering of existing Airtable Connections on `/integrations` SHALL behave identically to the `main` branch state before this change.

#### Scenario: Airtable Connect still works

- **WHEN** an authenticated user clicks "Connect Airtable" on `/integrations` on the branch with this change merged
- **THEN** the Airtable OAuth flow SHALL complete and a Connection SHALL be persisted, byte-identical in behavior to the same operation on `main` prior to this change

#### Scenario: Existing Connections still listed

- **WHEN** an authenticated user with one or more existing Airtable Connections navigates to `/integrations` on the branch with this change merged
- **THEN** every existing Connection SHALL render on the page identically to its rendering on `main` prior to this change
