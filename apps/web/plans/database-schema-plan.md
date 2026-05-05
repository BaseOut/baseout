# Database Schema Implementation Plan

**Created:** 2026-04-16
**Status:** Ready for implementation

---

## Overview

This plan covers building the Baseout database schema in two iterations:

- **Iteration 1 (now):** Schema A — 9 Better Auth tables + `connections` table (10 total)
- **Iteration 2 (later):** Schema B — add `spaces` + 13 more tables for full V1 (24 total)

All schemas target the empty `baseout-dev` database on the existing DigitalOcean PostgreSQL cluster.

---

## Iteration 1: Schema A (Starter)

### What We're Building
- Better Auth integration with organization + team plugins (9 tables)
- Airtable connection management (`connections` table)
- Drizzle ORM setup with read-only auth table references

### Prerequisites
Install dependencies:
```bash
npm install drizzle-orm postgres better-auth
npm install -D drizzle-kit
```

### Implementation Steps

#### Step 1: Environment setup
Create `.env` with database connection string pointing to `baseout-dev`.

#### Step 2: Create `drizzle.config.ts`
Configure Drizzle Kit to target `baseout-dev`, use the `src/db/schema/` directory.

#### Step 3: Create `src/db/index.ts`
Initialize Drizzle client with `postgres` driver and connection pool.

#### Step 4: Create `src/db/schema/auth.ts`
Define read-only Drizzle table definitions that mirror all 9 Better Auth tables (users, organizations, members, teams, team_members, invitations, identities, sessions, verifications). These are NOT migration-managed by Drizzle — they exist so Drizzle queries can join against auth tables.

#### Step 5: Create `src/db/schema/connections.ts`
Define the `connections` table with all columns, types, defaults, constraints, and indexes per the schema reference.

#### Step 6: Create `src/db/schema/enums.ts`
Define shared enum constants (platform types, status values, auth methods).

#### Step 7: Create `src/db/schema/index.ts`
Re-export all schema modules.

#### Step 8: Configure Better Auth
Set up Better Auth with organization plugin + team plugin. Run `auth.migrate()` on server startup to create the 9 auth tables.

#### Step 9: Generate + apply Drizzle migration
Run `drizzle-kit generate` for the `connections` table, review the SQL, run `drizzle-kit migrate`.

#### Step 10: Add supplementary indexes
Add `idx_members_user_org (user_id, organization_id)` on the Better Auth `members` table via a separate Drizzle migration.

### Verification
- Query `baseout-dev` to confirm all 10 tables exist with correct columns
- Test Better Auth signup flow creates user + org + member + session records
- Test inserting a connection record via Drizzle

---

## Iteration 2: Schema B (Full V1)

### Migration Phases

| Phase | Tables Added | Feature Area |
|-------|-------------|--------------|
| 3 | spaces, organization_profiles, storage_destinations | Core entities |
| 4 | backup_schedules, backup_runs, backup_snapshots | Backup pipeline |
| 5 | restore_runs, schema_snapshots, schema_fields | Restore + schema |
| 6 | subscriptions, api_tokens | Billing + API access |
| 7 | notification_rules, notification_log, audit_log | Notifications + audit |

Each phase is an independent Drizzle migration that can be deployed as features are built.

### Full table definitions
See [database-schemas-reference.md](database-schemas-reference.md) for complete column specs, types, and constraints for all 24 tables.

---

## File Structure (Final)

```
baseout-starter/
  drizzle.config.ts
  src/db/
    index.ts
    schema/
      index.ts
      auth.ts
      enums.ts
      connections.ts
      spaces.ts                    -- Iteration 2
      organization-profiles.ts     -- Iteration 2
      backup-schedules.ts          -- Iteration 2
      backup-runs.ts               -- Iteration 2
      backup-snapshots.ts          -- Iteration 2
      restore-runs.ts              -- Iteration 2
      schema-snapshots.ts          -- Iteration 2
      schema-fields.ts             -- Iteration 2
      storage-destinations.ts      -- Iteration 2
      subscriptions.ts             -- Iteration 2
      api-tokens.ts                -- Iteration 2
      notification-rules.ts        -- Iteration 2
      notification-log.ts          -- Iteration 2
      audit-log.ts                 -- Iteration 2
```

---

## Conventions

| Convention | Rule |
|------------|------|
| Table names | plural, snake_case |
| Column names | singular, snake_case |
| PKs | `id text NOT NULL DEFAULT gen_random_uuid()` |
| FKs | `{table_singular}_id` |
| Timestamps (auth) | `created_at`, `updated_at` (Better Auth managed) |
| Timestamps (app) | `created_at`, `modified_at` (Baseout managed) |
| Booleans | `is_` or `has_` prefix |
| Encrypted cols | `_enc` suffix |
| Status enums | CHECK constraints, not PG ENUM types |
