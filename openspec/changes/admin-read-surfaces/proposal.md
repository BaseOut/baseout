# admin-read-surfaces

> **Partly superseded by `admin-crm-ux` (2026-08-03):** the bounded row-limit wording on these read surfaces is replaced by URL-driven server-side pagination/sort/filter (`admin-table-infra`).

## Why

PRD §16.1 specifies the super-admin console's read-only capabilities: subscriptions visibility, cross-org backup run status, connection health, database provisioning tracking, background-service monitoring, and On2Air migration status. `admin-foundation` shipped exactly one surface (Organizations → Spaces tracker). This change builds the remaining read-only surfaces on that proven pattern, turning the tracer slice into a usable staff console. Manual admin actions + the append-only audit trail stay in the deferred `admin` umbrella change.

Sibling change [`shared-admin-dev-deploy`](../shared-admin-dev-deploy/proposal.md) makes the app deployable to dev Cloudflare; this change is admin-app-only.

## What Changes

Each surface = partial schema-mirror additions in `src/db/schema/core.ts` (no FKs, selected columns only, **never `*_enc` columns**) + a pure lib module taking `now: Date` + Vitest + a read-only `.astro` page (daisyUI, no mutation handlers, gated by the existing middleware).

1. **Nav** in `Layout.astro` — horizontal menu across all pages, active state from `Astro.url.pathname`.
2. **`/backups`** — cross-org backup run viewer absorbing web's `/ops` page, improved: joins spaces + organizations for names instead of raw UUIDs; 24h/7d status summary; `?status=` filter. (Retiring `apps/web/src/pages/ops/` is a flagged follow-up, not bundled.)
3. **`/subscriptions`** — org × subscription × items with pure trial-state derivation (trialing / trial expired / converted / never trialed), status/tier badges, period ends.
4. **`/connections`** — connection health classifier (healthy / token_expired / refresh_stuck / refresh_error / pending_reauth / invalid) + stale `connection_sessions` count + storage-destination OAuth health. Webhook renewal state does not exist yet (no table, cron unbuilt) — noted on-page.
5. **`/databases`** — `space_databases` provisioning tracker (backend/status, locators, schema version, sync timestamps, errors first). Utilization proxy = latest succeeded run's record/table/attachment counts; real byte metrics are a named phase-2 follow-up.
6. **`/migration`** — On2Air status from `organizations.has_migrated` + `dynamic_locked`: totals, pending list with subscription status.
7. **`/services`** — honest derived scheduler health (no cron-run table exists; server `scheduled()` is a phase-2 stub): overdue `backup_configurations` schedules, last scheduled run vs frequency, cleanup heartbeat via `backup_runs.deleted_at`, stale connection sessions. Labeled "derived from data side-effects".

**Deferred:** error log search (no Logpush infra exists anywhere — needs a Logpush job + R2 + indexer first); real DB utilization metrics; `service_runs` table.

## Out of scope

Manual admin actions, audit_log, Google SSO, web `/ops` deletion, any schema migrations (admin owns none — read-only mirrors only).
