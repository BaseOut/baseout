# DB Mirror

`apps/server` is **not** the migration owner. It mirrors specific master-DB tables from the canonical schema in `apps/web` so the Worker can read/write without crossing the network for every operation.

The master DB itself lives in DigitalOcean / Neon / Supabase. The frontend (`apps/web`) owns Drizzle migrations against it. This Worker has its own thin Drizzle definitions for the subset of tables it touches at runtime.

## Mirror Rule

Every Drizzle file in `apps/server/src/db/schema/` is a **mirror** of a canonical file in `apps/web`. Three rules:

1. The mirror file's column set is a **subset** of the canonical file. Never invent a column here.
2. The mirror file carries a header comment naming the canonical migration source path in `apps/web`.
3. When the canonical file changes, the mirror is updated **manually in the same PR** that ships the canonical migration. Drift is caught by CI tests against a real local PG.

Today the directory is empty — the engine is pre-Phase-1. Phase 1 introduces `backup_runs` and `backup_configuration_bases` mirrors.

## Planned Mirror Files

The first set of mirrors that land in Phase 1, with their canonical migration sources.

| Mirror file (planned) | Canonical source |
|---|---|
| `src/db/schema/backup-runs.ts` | `apps/web/drizzle/<NNNN>_backup_runs.sql` |
| `src/db/schema/backup-configuration-bases.ts` | `apps/web/drizzle/<NNNN>_backup_configuration_bases.sql` |

## What Is **Not** Mirrored

The Worker has no business reading these tables, so they are intentionally absent here:

- `users`, `sessions`, `accounts`, `verifications` — better-auth lives in the frontend only.
- `organizations`, `organization_members`, `subscriptions`, `subscription_items` — billing + identity belong in `apps/web`.
- `connections.oauth_*_enc` columns — encrypted tokens are written by the frontend; this Worker reads them via a narrow read-only view (planned).

If a Worker handler needs data from a non-mirrored table, the right answer is usually "ask `apps/web` over `/api/internal/*`" rather than "mirror more tables."

## Per-Request Client

The mirror tables are queried via the per-request client built in [src/db/worker.ts](../src/db/worker.ts). See [[architecture#Architecture#Per-Request masterDb]] for the lifecycle rules — postgres-js sockets must not survive the request.

## Where to Look

Pointers to canonical schema + mirror rules.

- Canonical schema (TypeScript): [master-schema.ts](../../../master-schema.ts)
- Schema spec (markdown): [shared/Master_DB_Schema.md](../../../shared/Master_DB_Schema.md)
- Frontend Drizzle migrations: `apps/web/drizzle/`
- Root schema overview: [root db-schema-overview](../../../lat.md/db-schema-overview.md)
