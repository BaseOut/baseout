## ADDED Requirements

### Requirement: Token creation with plaintext-once display
The web app SHALL let an Organization `owner` or `admin` create an API token by supplying a name (required, 1–100 chars), a non-empty subset of the v1 read scopes (`org:read`, `backups:read`, `schema:read`), an optional Space binding (must belong to the current Organization; absent = all Spaces), and an optional expiry preset. The token SHALL be minted via the shared `generateApiToken()` helper; only `token_prefix` and `token_hash` SHALL be persisted (PRD §21.3). The full plaintext SHALL be returned exactly once in the create response and displayed in a copy-to-clipboard modal with a not-shown-again warning; it MUST NOT be logged, stored client-side, or retrievable afterwards.

#### Scenario: Successful create
- **WHEN** an org admin submits name "CI reader" with scopes `backups:read` and no Space binding
- **THEN** a row is inserted with `organization_id` = current org, `space_id` NULL, the hash and prefix from the helper, and the response carries the full `bo_live_…` plaintext exactly once

#### Scenario: Plaintext is unrecoverable
- **WHEN** the create modal is dismissed and the Settings page re-renders
- **THEN** the token appears only as `token_prefix` + ellipsis, and no route exists that returns the plaintext again

#### Scenario: Invalid scope rejected
- **WHEN** a create request includes scope `backups:write`
- **THEN** the route responds 400 and no row is inserted

#### Scenario: Cross-org Space binding rejected
- **WHEN** a create request names a `spaceId` that belongs to a different Organization
- **THEN** the route responds 400 and no row is inserted

### Requirement: Token listing on the Settings page
The Settings page SHALL list the current Organization's tokens server-side: name, `token_prefix`, scopes, Space binding (or "All Spaces"), status (active / revoked / expired), `created_at`, `last_used_at`, and `expires_at`. Tokens of other Organizations MUST NOT be reachable. Members with role `member` SHALL see the list with create/revoke actions disabled.

#### Scenario: Org scoping
- **WHEN** a user whose current Organization is A opens Settings
- **THEN** only Organization A's `api_tokens` rows render, regardless of the user's memberships elsewhere

#### Scenario: Member sees read-only list
- **WHEN** a user with membership role `member` opens Settings
- **THEN** the token list renders but the Create and Revoke controls are disabled

### Requirement: Token revocation
An Organization `owner` or `admin` SHALL be able to revoke a token, after a confirmation prompt, via a session-authenticated CSRF-protected route that sets `is_active = false` on the row (soft revoke — the row is retained). Revocation SHALL be idempotent, and SHALL 404 for a token id not owned by the current Organization. Public-API auth (`apps/api`) already rejects inactive tokens, so no cross-app change is required for revocation to take effect.

#### Scenario: Revoke takes effect
- **WHEN** an admin confirms revocation of an active token
- **THEN** `is_active` becomes false, the list shows it as revoked, and a subsequent `apps/api` request bearing that token receives 401

#### Scenario: Already revoked is idempotent
- **WHEN** a revoke request targets an already-revoked token in the same Organization
- **THEN** the route responds 200 with no state change

#### Scenario: Foreign token invisible
- **WHEN** a revoke request targets a token id owned by another Organization
- **THEN** the route responds 404

### Requirement: Authorization and audit trail for token mutations
Create and revoke routes SHALL pass through the middleware session gate, resolve the Organization from the session (never from client input), and require membership role `owner` or `admin` (403 otherwise). Each successful create/revoke SHALL emit a structured-logger event (`api_token.created` / `api_token.revoked`) carrying org id, token id, and acting user id — never the plaintext or hash — as the interim audit trail until the customer audit-log table ships (questions-2026-07-20 item 12).

#### Scenario: Member cannot mutate
- **WHEN** a user with membership role `member` calls `POST /api/tokens`
- **THEN** the route responds 403 and no row is inserted

#### Scenario: Unauthenticated request blocked
- **WHEN** a request without a valid session cookie calls either route
- **THEN** the middleware rejects it before the handler runs
