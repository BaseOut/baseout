## Overview

Eight phases. The architectural decision is which tier to implement first. Recommendation: D1 (Schema Only) → D1 (Full) → Shared PG → Dedicated PG → BYODB. Each new tier reuses the previous tier's schema-DDL + run-side write code; only the provisioner + connection string shape changes.

The big architectural call: **the engine connects directly to per-Space client databases, not through apps/web**. Per CLAUDE.md §5.2 the engine's only public-internal API is `/api/internal/*` — but apps/server reaches *out* to D1 and Postgres via direct connections. apps/web has no need to talk to the dynamic DB; it reads `space_databases.status` from master DB to show the provisioning state.

The second architectural call: **dynamic mode runs alongside static, not instead of it**. A Space with `mode='dynamic'` still writes a CSV to R2 (or BYOS) for the user's downstream convenience; it ALSO writes records to the dynamic DB. This is consistent with the [PRD §2.1 carry-forward](../../../shared/Baseout_PRD.md) "keep CSV" decision.

## Phase A — `space_databases` schema

```sql
CREATE TABLE baseout.space_databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL UNIQUE REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('d1_schema_only','d1_full','shared_pg','dedicated_pg','byodb')),
  status text NOT NULL CHECK (status IN ('provisioning','ready','suspended','error')) DEFAULT 'provisioning',
  d1_database_id text,
  pg_connection_string_enc text,
  pg_schema_name text,
  byodb_connection_string_enc text,
  last_schema_sync_at timestamp with time zone,
  last_records_sync_at timestamp with time zone,
  provisioned_by_user_id uuid REFERENCES baseout.users(id) ON DELETE SET NULL,
  provisioned_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now()
);
```

## Phase B — Provisioner design

`apps/server/src/lib/dynamic/provisioner.ts` exports `provisionDatabase(spaceId, tier, deps)` which dispatches per tier:

```ts
switch (tier) {
  case 'd1_schema_only':  return provisionD1SchemaOnly(spaceId, deps)
  case 'd1_full':         return provisionD1Full(spaceId, deps)
  case 'shared_pg':       return provisionSharedPg(spaceId, deps)
  case 'dedicated_pg':    return provisionDedicatedPg(spaceId, deps)
  case 'byodb':           return provisionByodb(spaceId, deps)
}
```

### D1 Schema Only

Shared D1 database. Tables `_baseout_tables`, `_baseout_fields`, `_baseout_records_summary` (count only) are namespaced per Space via `space_id` column. Provisioner just INSERTs a `space_databases` row with `d1_database_id` = the shared DB ID + `status='ready'` (no actual provisioning needed since the shared DB is pre-existing).

### D1 Full

One D1 database per Space. Provisioner calls Cloudflare D1 REST API:

```
POST https://api.cloudflare.com/client/v4/accounts/<account>/d1/database
Body: { name: "baseout-space-<spaceId>" }
```

Returns `{ uuid }`. Runs schema-DDL:

```sql
CREATE TABLE _baseout_tables (...)
CREATE TABLE _baseout_fields (...)
CREATE TABLE _baseout_runs_log (...)
```

Per-base record tables are created at first-write time per the engine path.

### Shared PG

Connects to the DigitalOcean Shared PG cluster (env: `DO_SHARED_PG_ADMIN_URL`). Creates a per-Space schema:

```sql
CREATE SCHEMA "space_<spaceId truncated to 30 chars>"
CREATE ROLE "space_<spaceId>_rw" LOGIN PASSWORD '<random>'
GRANT USAGE, CREATE ON SCHEMA "space_..." TO "space_..._rw"
GRANT ALL ON ALL TABLES IN SCHEMA "space_..." TO "space_..._rw"
```

Build a connection string with the per-Space role + password, AES-256-GCM encrypt, persist.

### Dedicated PG

Calls Neon or Supabase REST API. Picks an account based on env config (`NEON_API_KEY` or `SUPABASE_API_KEY`). Returns a new database + connection string. Same schema-DDL run.

### BYODB

User provides a connection string via the UI. Provisioner validates with a probe query, runs the schema-DDL, persists.

### Provisioner Trigger.dev task

```ts
// apps/workflows/trigger/tasks/provision-space-database.task.ts

export const provisionSpaceDatabase = task({
  id: 'provision-space-database',
  retry: { maxAttempts: 3, backoff: 'exponential' },
  run: async (payload: { spaceId: string; tier: DatabaseTier }, { ctx }) => {
    return await provisionDatabase(payload.spaceId, payload.tier, deps)
  },
})
```

Failure paths: persist `error_message` to `space_databases`; dashboard shows the error.

## Phase C — Engine write path

The per-base task gains a `writeDynamic(...)` branch:

```ts
const config = await loadBackupConfig(spaceId)
const dynamicDb = config.mode === 'dynamic' ? await loadSpaceDatabase(spaceId) : null

for await (const page of pageRecords(baseId, tableId)) {
  // Existing static path
  if (config.mode === 'static' || config.mode === 'dynamic') {
    csvBuffer.append(serializeForCsv(page.records))
  }

  // New dynamic path
  if (config.mode === 'dynamic' && dynamicDb?.tier !== 'd1_schema_only') {
    await upsertRecordsToDynamic(dynamicDb, baseId, tableId, page.records)
  }
}

// At end of table:
if (config.mode === 'dynamic') {
  await upsertSchemaToDynamic(dynamicDb, baseId, tableMetadata)
}
```

`upsertRecordsToDynamic` uses `ON CONFLICT (record_id) DO UPDATE SET ...` for Postgres; D1 uses `INSERT OR REPLACE`. Per-table tables are auto-created on first write via `CREATE TABLE IF NOT EXISTS`.

## Phase D — Schema diff

`apps/server/src/lib/dynamic/schema-differ.ts`:

```ts
diffSchema(prev: TableSchema[], curr: TableSchema[]): SchemaDiff
```

Compares each table by Airtable ID; for matching tables, compares each field by Airtable field ID; flags renames by matching ID-with-changed-name; flags retypes by field-ID-with-changed-type. Writes each diff entry to `audit_history` table with `event_type='schema_change'`.

The `audit_history` table itself is defined in `baseout-db-schema` (already filed). This change consumes it.

## Phase E — Capability resolver

```ts
resolveBackupMode(tier): ('static' | 'dynamic')[]
// Trial/Starter: ['static', 'dynamic']  // dynamic auto-flipped to schema-only
// Launch+: ['static', 'dynamic']

resolveDatabaseTier(tier): DatabaseTier
// Trial/Starter:  'd1_schema_only'
// Launch/Growth:  'd1_full'
// Pro:            'shared_pg'
// Business:       'dedicated_pg'
// Enterprise:     'byodb'
```

PATCH validation: a Trial/Starter Space setting `mode='dynamic'` auto-translates to `tier='d1_schema_only'`; full record storage requires upgrade.

## Phase F — Provisioning triggers

### Stripe webhook

```
event: customer.subscription.updated
if (newTier supports dynamic && oldTier did not):
  for each space in org:
    enqueue provisionSpaceDatabase({ spaceId, tier: resolveDatabaseTier(newTier) })
```

### First-backup defensive trigger

In `apps/server/src/lib/runs/start.ts` (existing `processRunStart`):

```ts
if (config.mode === 'dynamic') {
  const dynDb = await loadSpaceDatabase(spaceId)
  if (!dynDb || dynDb.status !== 'ready') {
    // Queue provisioning if not already
    if (!dynDb) await enqueueProvision(spaceId, resolveDatabaseTier(tier))
    // Run still proceeds — engine writes static (CSV) immediately; dynamic
    // writes deferred until next run after provisioning completes.
    return { warning: 'dynamic_db_not_ready' }
  }
}
```

### Downgrade

```
if (newTier does NOT support dynamic && oldTier did):
  UPDATE space_databases SET status='suspended' WHERE space_id IN (...)
  // Decommission scheduled in baseout-dynamic-db-decommission follow-up
```

## Phase G — Dashboard

Per-Space card additions:

```
[ Backup history ]
[ Backup config ]
[ Dynamic database — Status: <status> · Tier: <tier> · Last schema sync: <relative> ]
```

For Pro+ PG-tier Spaces: future "Connection info" disclosure (placeholder; SQL API change owns).

## Wire shapes

| Direction | Path | Verb | Change |
|---|---|---|---|
| apps/web → engine | `/api/internal/spaces/:id/provision-database` | POST | new |
| engine → engine (callback) | `/api/internal/spaces/:id/database-status` | POST | new |
| apps/web → apps/web | `/api/spaces/:id/database-status` | GET | new (dashboard) |
| apps/web → apps/web | `/api/spaces/:id/backup-config` PATCH | additive: `mode='dynamic'` allowed for Launch+ |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `resolveBackupMode` + `resolveDatabaseTier` per tier. |
| Pure | `diffSchema(prev, curr)` — added/removed/renamed/retyped cases. |
| Pure | `buildPgPerSpaceConnectionString(adminUrl, spaceId, roleName, password)` shape. |
| Integration | Provisioner per tier — mock the Cloudflare/DigitalOcean/Neon REST APIs; assert correct calls + retry behavior. |
| Integration | `backup-base.task.dynamic.test.ts` — dynamic mode writes the expected schema + record tables. |
| Integration | Schema-diff write — second run with a renamed field produces a correct `audit_history` row. |
| Smoke | Per tier, real provisioning in a dev account (D1 free, DO dev cluster, Neon dev project). |

## Master DB migration

`apps/web/drizzle/0012_space_databases.sql` per Phase A. Engine mirror in `apps/server/src/db/schema/space-databases.ts`.

## Operational concerns

- **Provisioning failures**: a Stripe upgrade can succeed while provisioning fails (Cloudflare API outage, etc.). The `space_databases.error_message` + dashboard surface this; user can retry via "Re-provision database" button. Operator runbook covers manual rescue.
- **D1 rate limits**: Cloudflare's D1 create-database API is rate-limited; provisioning bursts (e.g. a 1000-Space migration) need throttling. Out of MVP scope; default to one provisioning at a time per Worker.
- **PG admin credentials**: `DO_SHARED_PG_ADMIN_URL` is a sensitive secret. Limit blast radius via per-Space role grants (above). Never log admin credentials.
- **BYODB security**: customer-supplied connection strings persist encrypted but are decrypted in-Worker per backup run. A malicious connection string could exfiltrate data (e.g. point to attacker-controlled PG). Mitigation: validate the host belongs to a known PG service (Neon, Supabase, RDS, etc.) at connect time; out of MVP scope for full hardening.
- **Cost**: per-tier cost matters. Each Business Space spins up a Neon/Supabase database; pricing per [Features §3](../../../shared/Baseout_Features.md) is set with this in mind.

## What this design deliberately doesn't change

- The static (CSV → R2) path. Continues unchanged; runs alongside dynamic.
- The SQL API (`apps/sql`). This change provisions the DB; the SQL surface is a separate change.
- The restore engine. Will read from the dynamic DB when implemented.
- The schema-changelog UI. Will read `audit_history` when implemented.
- Customer-facing connection-string output. Read-only access via SQL API is the proper interface; raw connection strings aren't exposed to customers in MVP.
