## ADDED Requirements

### Requirement: Per-tier provisioner dispatch

The provisioner SHALL dispatch on `space_databases.tier` to one of five tier-specific implementations: `d1_schema_only`, `d1_full`, `shared_pg`, `dedicated_pg`, `byodb`. Each implementation SHALL be idempotent — re-running on a row with `status='ready'` SHALL be a no-op.

#### Scenario: Re-provision on ready row

- **WHEN** `provisionDatabase(spaceId, tier)` is called for a Space whose `space_databases.status='ready'`
- **THEN** the provisioner SHALL return success without making any external API calls

#### Scenario: Provisioning failure persists error

- **WHEN** the Cloudflare D1 create-database API returns 500 after retries are exhausted
- **THEN** the provisioner SHALL UPDATE `space_databases.status='error'` and `error_message=<detail>` before propagating the failure

### Requirement: Stripe webhook triggers provisioning on upgrade

When the Stripe `customer.subscription.updated` webhook indicates a tier change from a non-dynamic tier to a dynamic-supporting tier, apps/web SHALL enqueue the provisioner Trigger.dev task for every Space in the Org.

#### Scenario: Trial → Launch upgrade

- **WHEN** an Org upgrades from Trial to Launch via Stripe
- **THEN** for every Space in the Org, `provisionSpaceDatabase({ spaceId, tier: 'd1_full' })` SHALL be enqueued

### Requirement: Downgrade suspends without delete

When the Stripe webhook indicates a tier change from a dynamic-supporting tier to a non-dynamic tier, apps/web SHALL UPDATE every affected Space's `space_databases.status='suspended'` and SHALL NOT delete the underlying D1 / Postgres instance. Hard-deletion is the responsibility of a separate decommission change.

#### Scenario: Launch → Starter downgrade

- **WHEN** an Org downgrades from Launch to Starter
- **THEN** every dynamic Space's `space_databases.status` SHALL be set to `suspended` and the dashboard SHALL display "Dynamic backups paused — upgrade to resume"

### Requirement: BYODB connection-string encryption

For `tier='byodb'`, the connection string supplied by the customer SHALL be encrypted with AES-256-GCM using the master key from `@baseout/shared` and persisted to `byodb_connection_string_enc`. The plaintext SHALL never be logged or returned in API responses.

#### Scenario: BYODB connect form submission

- **WHEN** an Enterprise customer submits a connection string via `POST /api/spaces/:id/byodb-connect`
- **THEN** the route SHALL probe the database with a `SELECT 1`, run schema DDL, encrypt the connection string, persist, and return `{ ok: true }` without echoing the plaintext

### Requirement: Status reachability from apps/web

apps/web SHALL expose `GET /api/spaces/:id/database-status` returning the current `space_databases` row shape sans encrypted columns. The route SHALL be used by the per-Space dashboard card to surface provisioning state.

#### Scenario: Dashboard reads status

- **WHEN** the dashboard loads a Space's `database-status` endpoint while provisioning is in progress
- **THEN** the response SHALL include `{ status: 'provisioning', tier, error_message: null }` without any token/credential fields
