## Why

[PRD §5.1](../../../shared/Baseout_PRD.md) defines three backup modes:

> | Mode | Storage | Tier |
> | Static | CSV → R2 / BYOS | All |
> | Dynamic (Schema Only) | D1 schema metadata only | Trial, Starter |
> | Dynamic (Full) | D1 / Shared PG / Dedicated PG | Launch+ |

The `backup_configurations.mode` column already exists (added in Phase 10a) and accepts `'static' | 'dynamic'`. The engine reads it but only branches on `static` — `dynamic` is treated as a no-op extension of static. No client database is provisioned, no schema gets written to D1, no record table is materialized.

[Features §4.3 Database Tier Details](../../../shared/Baseout_Features.md) breaks dynamic into five sub-tiers:

| Tier | Engine | Hosting | Isolation | SQL Access |
|---|---|---|---|---|
| D1 (Schema Only) | SQLite | Cloudflare D1 | Shared | ✗ |
| D1 (Full) | SQLite | Cloudflare D1 | Per-database | ✓ |
| Shared PostgreSQL | PG 16 | DigitalOcean | Schema-level | ✓ |
| Dedicated PostgreSQL | PG 16 | Neon/Supabase/DO | Full instance | ✓ |
| BYODB | PG 13+ | Customer-hosted | Customer-controlled | ✓ |

Dynamic mode is the load-bearing prerequisite for everything else that needs queryable record state:

- **Direct SQL API (Pro+)** — `sql.baseout.com` per [PRD §10](../../../shared/Baseout_PRD.md) reads from the Space's dynamic DB. No dynamic mode = no SQL API.
- **Schema Diff / Schema Changelog (Launch+)** — diffs need a stored schema to compare against.
- **AI Schema Insight + AI Doc Generation** — query the schema.
- **Restore engine** — writes back to Airtable from the dynamic DB row set.
- **Instant (webhook) backups** — append-only incremental writes to the dynamic DB.

This is the biggest architectural change still in the MVP backlog. Reasonable approach: ship the D1 (Schema Only) tier first (Trial/Starter — smallest surface), then D1 Full (Launch/Growth), then Shared PG (Pro), then Dedicated PG (Business). BYODB (Enterprise) is its own follow-up because the customer-hosted shape needs an entirely different connection model.

## What Changes

### Phase A — Database-provisioning architecture

- **New table `space_databases`** in master DB:
  - `id uuid PK`
  - `space_id uuid FK → spaces.id, unique`
  - `tier text NOT NULL CHECK (tier IN ('d1_schema_only','d1_full','shared_pg','dedicated_pg','byodb'))`
  - `status text NOT NULL CHECK (status IN ('provisioning','ready','suspended','error'))` — visible state machine
  - `d1_database_id text NULL` — Cloudflare D1 database ID (D1 tiers)
  - `pg_connection_string_enc text NULL` — AES-256-GCM ciphertext of the connection string (PG tiers)
  - `pg_schema_name text NULL` — for Shared PG, the per-Space schema (`space_<spaceId_truncated>`)
  - `byodb_connection_string_enc text NULL` — for Enterprise (customer-provided)
  - `last_schema_sync_at timestamp with time zone`
  - `last_records_sync_at timestamp with time zone`
  - `provisioned_by_user_id uuid FK → users.id`
  - `provisioned_at timestamp with time zone`
  - `created_at`, `modified_at`
- **State machine**: `provisioning → ready → suspended` (on plan downgrade) or `provisioning → error` (on provision failure). Visible on the dashboard.

### Phase B — Provisioner

- **New module** `apps/server/src/lib/dynamic/provisioner.ts`:
  - `provisionD1SchemaOnly(spaceId, deps)` — creates a row in a shared D1 database with a per-Space prefix.
  - `provisionD1Full(spaceId, deps)` — creates a dedicated D1 database via the Cloudflare REST API; runs the schema-only DDL + per-Space migrations.
  - `provisionSharedPg(spaceId, deps)` — connects to DigitalOcean shared PG cluster; `CREATE SCHEMA space_<spaceId>` + per-Space role with limited grants; persists the connection string.
  - `provisionDedicatedPg(spaceId, deps)` — provisions a Neon/Supabase database via their REST API; runs the schema DDL.
  - `provisionByodb(spaceId, connectionString, deps)` — validates the customer-supplied connection string + runs schema DDL.
- **Trigger.dev task** `apps/workflows/trigger/tasks/provision-space-database.task.ts` invokes the appropriate function per tier. Set on Stripe webhook upgrade or first-backup trigger.
- **Provisioner is idempotent**: re-running on a Space that already has `status='ready'` returns no-op.

### Phase C — Engine write path

- **In `backup-base.task.ts`** — branch on `backup_configurations.mode === 'dynamic'`:
  - Load the Space's `space_databases` row.
  - For each table:
    - **Schema**: UPSERT into the dynamic DB's `_baseout_tables`, `_baseout_fields` metadata tables.
    - **Records (Full tier only)**: UPSERT each record into a dynamically-named table `<table_name_normalized>` keyed by Airtable record ID. INSERT/UPDATE/DELETE based on diff with previous run.
    - **Attachments (Full tier only)**: row in `<table>_attachments` with `composite_id` → R2 (or BYOS) key.
- **Schema-Only tier**: skip the records UPSERT; only `_baseout_tables` + `_baseout_fields` are populated.
- **Run completion**: set `space_databases.last_schema_sync_at` (always) and `last_records_sync_at` (Full only).
- **Static-mode continues to work in parallel**: a Space can run static-mode CSV exports AND have a dynamic DB. The CSV goes to R2; the dynamic DB stays in sync.

### Phase D — Schema diff

- **New module** `apps/server/src/lib/dynamic/schema-differ.ts` — given previous schema + current schema, produce a `SchemaDiff` shape (`tables: { added, removed }`, `fields: { added, removed, renamed, retyped }`).
- **Audit log writes** — each diff insert lands in an `audit_history` table (per [PRD §3.2 Schema Changelog](../../../shared/Baseout_PRD.md)) for the changelog UI.
- **Out of this change**: the changelog viewer UI. Lands in a separate `baseout-schema-changelog-ui` follow-up.

### Phase E — Capability resolver

- Extend `apps/web/src/lib/billing/capabilities.ts`:
  - `resolveBackupMode(tier)` — returns `['static']` for Trial/Starter or `['static', 'dynamic']` for Launch+.
  - `resolveDatabaseTier(tier)` — Trial/Starter → `d1_schema_only`; Launch/Growth → `d1_full`; Pro → `shared_pg`; Business → `dedicated_pg`; Enterprise → `byodb`.
- **PATCH validation** on `backup-config`: reject `mode='dynamic'` for Starter/Trial except as schema-only (auto-flipped).

### Phase F — Provisioning trigger

- **On Stripe upgrade webhook** (`subscription.updated` to a tier with dynamic support): enqueue the provisioner Trigger.dev task.
- **On first backup of a dynamic-eligible Space** (defensive fallback): if `space_databases` row doesn't exist, enqueue provisioner inline. The backup queues itself until `status='ready'`.
- **On plan downgrade**: if tier loses dynamic support, set `status='suspended'`. The DB is retained for the retention window then deleted by a separate `baseout-dynamic-db-decommission` follow-up.

### Phase G — Dashboard surface

- **Per-Space dashboard card** showing `space_databases.status` + tier + last_sync timestamps + a "Schema-only" / "Full" / "Shared PG" badge.
- **For PG-tier Spaces**: a "Connection info" disclosure showing the read-only SQL endpoint + credentials (when the SQL API ships — placeholder here).
- **For BYODB Spaces**: a "Connect your DB" form when status=`provisioning`.

### Phase H — Doc sync

- Update [openspec/changes/baseout-server/specs/backup-engine/spec.md](../baseout-server/specs/backup-engine/spec.md) — dynamic mode requirement now has an implementation change.
- Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) — link as resolved follow-up.
- Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md).

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `baseout-direct-sql-api` (probably already filed in `openspec/changes/baseout-sql`) | The `sql.baseout.com` REST surface that reads from a Space's dynamic DB. Depends on this change but is its own surface. |
| Future change `baseout-schema-changelog-ui` | UI for browsing the diffs this change writes to `audit_history`. |
| Future change `baseout-dynamic-db-decommission` | Hard-delete of suspended dynamic DBs after retention. |
| Future change `baseout-restore-engine` | The restore path that reads from the dynamic DB and writes back to Airtable. |
| Future change `baseout-backup-byodb-validation` | Hardening of the BYODB tier (Enterprise) — schema migration, key rotation, etc. First-pass MVP accepts a connection string and runs the same DDL. |
| Bundled with `baseout-backup-attachments` | Attachment-bytes counting in `<table>_attachments` rows. |
| Bundled with `baseout-backup-instant-webhook` | Append-only incremental writes for webhook-driven backups. |

## Capabilities

### New capabilities

- `backup-dynamic-mode` — alternative write path that lands schema + records in a per-Space client database. Owned by `apps/server`.
- `dynamic-database-provisioning` — Cloudflare D1 / Postgres / BYODB provisioner. Owned by `apps/server`.
- `backup-schema-differ` — schema-diff computation between runs. Owned by `apps/server`.

### Modified capabilities

- `backup-engine` — gains a second write branch for `mode='dynamic'`. Static path unchanged.
- `backup-config-policy` — `mode` validation against tier.
- `capability-resolution` — `resolveBackupMode`, `resolveDatabaseTier`.

## Impact

- **Master DB**: one additive migration. New `space_databases` table.
- **Per-Space client DBs**: every dynamic-eligible Space gets a new D1 database (or a Postgres schema). At MVP scale (hundreds of Spaces), Cloudflare D1's free-tier limits accommodate the schema-only tier. Pro+ Spaces consume DigitalOcean Shared PG storage; Business+ each get their own Neon/Supabase instance — Stripe billing must reflect.
- **External provisioning calls**: Cloudflare D1 API, DigitalOcean PG API, Neon/Supabase API. Each is rate-limited; provisioner has retry logic.
- **Cost**: significant. Per-Space PG instances aren't cheap. The product price points (Pro $99, Business $249) per [Features §3](../../../shared/Baseout_Features.md) factor this in.
- **Cross-app contract** (new wire shapes):
  - apps/web → engine: `POST /api/internal/spaces/:id/provision-database`. Body: `{ tier }`. Returns `{ status, message }`.
  - engine → engine (callback): provisioner Trigger.dev task posts to `/api/internal/spaces/:id/database-status` to update `space_databases.status`.

## Reversibility

- **Phase A** (schema): additive. Reverting leaves the table empty.
- **Phase B** (provisioner): pure code addition. Once a D1 / PG database exists, it persists; tearing down requires the `baseout-dynamic-db-decommission` follow-up.
- **Phase C** (engine path): branching on `mode`. Reverting falls back to static-only.
- **Phases D–G**: roll-forward.

The forward-only data is the per-Space DBs themselves. If we revert after a customer's dynamic DB has been provisioned, the DB persists; the customer just stops getting writes to it. A separate decommission path is required for actual cleanup.
