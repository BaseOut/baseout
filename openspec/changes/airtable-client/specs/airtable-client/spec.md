## ADDED Requirements

### Requirement: Shared Airtable OAuth helpers

The Baseout monorepo SHALL host Airtable OAuth helpers (PKCE pair generation, authorize URL construction, token exchange, refresh-token exchange) in `@baseout/shared/airtable`. The helpers SHALL be Web Crypto / `fetch`-only (no Node primitives) and importable from any Cloudflare Worker app.

#### Scenario: apps/web consumes shared OAuth helpers

- **WHEN** `apps/web` initiates an Airtable OAuth flow
- **THEN** it imports `generatePkcePair`, `buildAuthorizeUrl`, and `exchangeCodeForTokens` from `@baseout/shared/airtable`
- **AND** behaves identically to the pre-extraction implementation (same PKCE, same scopes, same redirect URI handling)

#### Scenario: apps/server consumes shared OAuth helpers

- **WHEN** `apps/server` needs to refresh an Airtable access token
- **THEN** it imports `refreshAccessToken` from `@baseout/shared/airtable/refresh`
- **AND** the helper makes the same Airtable token-endpoint call shape as the apps/web equivalent

### Requirement: Records API client

`@baseout/shared/airtable` SHALL expose a Records API client `listRecords(baseId, tableId, opts)` that returns paginated records with cursor advancement, handles HTTP 429 by parsing `Retry-After` and retrying after the indicated delay, and returns typed errors for token/permission/base failures.

#### Scenario: Records pagination advances cursor

- **WHEN** Airtable responds with `{ records, offset }`
- **THEN** the caller may invoke `listRecords` again with `opts.offset = offset` to fetch the next page
- **AND** when Airtable responds without `offset`, pagination is complete

#### Scenario: 429 with Retry-After is honored

- **WHEN** Airtable responds with HTTP 429 and a `Retry-After: 5` header
- **THEN** the client waits ≥ 5 seconds before retrying
- **AND** retries up to a configured maximum (default 5) before throwing `RateLimitError`

#### Scenario: 5xx backoff is jittered and capped

- **WHEN** Airtable responds with HTTP 503
- **THEN** the client retries with exponential backoff plus jitter
- **AND** the per-attempt delay never exceeds 60 seconds

#### Scenario: Token expiry surfaces as a typed error

- **WHEN** Airtable responds with HTTP 401
- **THEN** the client throws `TokenExpiredError` (not a generic Error) so callers can trigger refresh

### Requirement: Attachment URL refresh

`@baseout/shared/airtable` SHALL detect Airtable attachment URLs that expire within a configurable window (default 60 minutes) and SHALL re-fetch the parent record to obtain refreshed URLs.

#### Scenario: Fresh URL passes through

- **WHEN** an attachment URL has > 60 minutes remaining before expiry
- **THEN** `refreshAttachmentUrls` returns the existing URL unchanged

#### Scenario: Near-expiry URL is refreshed

- **WHEN** an attachment URL has ≤ 60 minutes remaining before expiry
- **THEN** `refreshAttachmentUrls` re-fetches the record and returns the new URL from the same field

#### Scenario: Refresh failure throws

- **WHEN** the record re-fetch fails (404, 403, network error)
- **THEN** `refreshAttachmentUrls` throws an Airtable-typed error rather than returning a stale URL silently

### Requirement: Enterprise scope variant detection

`@baseout/shared/airtable` SHALL inspect the granted-scopes list returned at OAuth exchange and SHALL classify the connection as Enterprise when ANY scope begins with `enterprise.`. The classification SHALL be persisted to `connections.is_enterprise`.

#### Scenario: Standard-scope connection

- **WHEN** the granted scopes are `["data.records:read", "schema.bases:read", "webhook:manage"]`
- **THEN** `detectEnterpriseScopes` returns `{ isEnterprise: false, capabilities: [] }`

#### Scenario: Enterprise-scope connection

- **WHEN** the granted scopes include `"enterprise.metadata:read"` or any other `enterprise.*` scope
- **THEN** `detectEnterpriseScopes` returns `{ isEnterprise: true, capabilities: [...] }`
- **AND** `connections.is_enterprise` is set to `true` on persist

### Requirement: AES-256-GCM token storage

The Airtable client library SHALL encrypt access tokens and refresh tokens with AES-256-GCM via `@baseout/shared/crypto` before any persist to the master DB. The library SHALL never accept or return plaintext tokens across module boundaries except inside the request that just exchanged or refreshed them.

#### Scenario: OAuth callback persists encrypted

- **WHEN** apps/web's OAuth callback receives `{ access_token, refresh_token }` from Airtable
- **THEN** both values are encrypted via `encrypt()` from `@baseout/shared/crypto` before any DB write
- **AND** the master DB columns `connections.access_token_enc` and `connections.refresh_token_enc` hold ciphertext

#### Scenario: Server reads decrypts at request scope

- **WHEN** apps/server's `getAirtableClient(connectionId)` is called
- **THEN** the encrypted token is read from `connections.access_token_enc`, decrypted via `decrypt()`, and the plaintext lives only in the request handler's local scope (no module-level cache)

### Requirement: Per-request master DB connection

The Airtable client wiring in apps/server SHALL acquire its master DB handle via the existing per-request `createMasterDb()` helper and SHALL release the handle via `ctx.waitUntil(sql.end({ timeout: 5 }))` on response. Module-level DB singletons SHALL NOT be used for serving requests.

#### Scenario: getAirtableClient acquires per-request DB

- **WHEN** a Worker request calls `getAirtableClient(connectionId)`
- **THEN** a fresh masterDb handle is created from `apps/server/src/db/worker.ts` `createMasterDb()`
- **AND** the handle is closed in the response `waitUntil` lifecycle
