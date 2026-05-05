## Why

Baseout's back-of-house systems — backup engine, restore engine, background cron services, and operator tooling — are the load-bearing core of the product: they execute customer backups, hold rate-limited Airtable connections open for the lifetime of a run, persist captured data into client databases, and renew the secrets that keep all of this functional. None of it exists yet. This change converts the existing `Back_PRD.md` (V1.0) into spec-driven OpenSpec artifacts so the V1 build can be sequenced, tracked, and validated against testable requirements.

## What Changes

- Establish one new repo `baseout-server` deployed as a single Cloudflare Workers project that hosts the consolidated backup engine, background-service cron handlers, Airtable webhook receiver, Inbound API ingestion endpoints, SQL REST API, and super-admin Astro SSR surface.
- Build the backup engine on Cloudflare Durable Objects (per-Connection rate-limit gateway + per-Space backup state machine) plus Trigger.dev V3 workflows (one job per base backup, unlimited concurrency).
- Implement static and dynamic backup modes with destination strategies for Cloudflare R2 (managed) plus six BYOS providers (Google Drive, Dropbox, Box, OneDrive, S3, Frame.io).
- Implement the restore engine with base-level / table-level / point-in-time scope and Community Restore Tooling AI-prompt bundles for Pro+.
- Provision client databases on demand across four tiers (D1 → Shared PG → Dedicated PG → BYODB) with tier-migration tooling.
- Compute schema diffs and health scores per backup run and expose them via read endpoints to front.
- Ingest Airtable webhooks for Instant Backup (Pro+), with cursor-tracked coalescing in the per-Space DO and full-table fallback on gap detection.
- Run seven cron-based background services for webhook renewal, OAuth refresh, dead-connection notification cadence, trial-expiry monitoring, quota monitoring, smart-cleanup scheduling, and the connection-lock manager.
- Expose a custom Cloudflare Worker SQL REST API (Pro+) with read-only enforcement, parameterized queries, rate limits, and credit consumption.
- Surface read-only Direct SQL connection strings (Business+) with periodic credential rotation.
- Implement the back-side credit-consumption ledger and pause long-running backups mid-run when a dollar overage cap is reached.
- Send back-owned operational emails (audit reports, alerts, dead-connection cadence, quota warnings, etc.) via React Email + Mailgun, with back's own Mailgun key.
- Serve the super-admin surface as Astro SSR routes inside `baseout-server` (Astro Cloudflare adapter), bound to a distinct hostname (e.g., `admin.baseout.com`) with its own Google SSO auth namespace separate from the customer-facing `baseout-web` app, and an immutable audit log.
- Run a one-shot On2Air migration script (read legacy DB → map to Baseout tiers → create orgs/Stripe subscriptions → re-encrypt secrets → grant migration credits → idempotent re-run).

## Capabilities

### New Capabilities

- `backup-engine`: Backup execution across static and dynamic modes, all trigger sources (scheduled, manual, webhook-driven), trial cap enforcement, attachment dedup, file path layout, and per-run audit reports.
- `restore-engine`: Restore execution to new bases or new tables in existing bases, point-in-time selection, post-restore verification (Growth+), Community Restore Tooling AI-prompt bundles (Pro+), and restore credit accounting.
- `storage-destinations`: Server-side write strategies for Cloudflare R2 plus BYOS Google Drive, Dropbox, Box, OneDrive, S3, and Frame.io behind a common `StorageWriter` interface.
- `database-provisioning`: On-demand client DB provisioning across D1, Shared PG, Dedicated PG, and BYODB; tier-migration flow with grace-period decommission.
- `schema-diff`: Schema diff + changelog computation per run, human-readable rendering endpoint, and health-score computation per Base from configurable rules.
- `airtable-webhook-ingestion`: Public webhook receiver, HMAC verification, per-Space DO event coalescing, cursor advancement, gap-detection fallback, and webhook lifecycle management.
- `background-services`: Seven cron-triggered handlers within `baseout-server` (webhook renewal, OAuth token refresh, dead-connection cadence, trial-expiry monitor, quota-usage monitor, smart-cleanup scheduler, connection-lock manager) running idempotently against `notification_log` for stateful flows.
- `sql-rest-api`: Custom Cloudflare Worker exposing read-only SQL access to a Space's dynamic DB with bearer auth, parameterized queries, tier-based rate limits, credit consumption, and response-size cap.
- `direct-sql-access`: Read-only PostgreSQL connection string for Business+ tiers with periodic credential rotation and dual-validity overlap.
- `back-credit-consumption`: `credit_transactions` writes for back-executed operations (backup, restore, smart cleanup, SQL REST), bucket priority debiting, mid-run overage cap pause behavior, and direct Stripe metered-usage reporting at period close.
- `back-email-notifications`: React Email + Mailgun templates and sends for back-owned email categories (backup audit, failure/warning, trial cap, trial expiry, dead-connection cadence, quota warning, overage, schema change, health score change, restore complete, webhook renewal failure).
- `super-admin-app`: Astro SSR routes inside `baseout-server` served on a distinct admin hostname with its own Google SSO auth namespace, capability surfaces (org browser, subscription dashboard, run viewer, DB tracker, connection health, background-service monitor, migration status, manual admin actions, error log search), and immutable audit trail.
- `on2air-migration-script`: One-shot worker that reads the legacy On2Air DB, maps customers to Baseout tiers, creates Baseout organizations and Stripe subscriptions, re-encrypts persisted secrets under AES-256-GCM, grants migration credits per the credit-system spec, and supports dry-run + idempotent re-run.

### Modified Capabilities

None — this is the initial back implementation. No prior specs exist in `openspec/specs/`.

## Impact

- **New repo**: `baseout-server` — a single git repo deployed as one Cloudflare Workers project that handles HTTP routes (REST + webhook receivers), cron triggers (background services), Durable Objects (per-Connection + per-Space), Trigger.dev integration, the SQL REST API endpoint, and Astro SSR routes for the super-admin surface (admin hostname).
- **External dependencies**: Cloudflare Workers + Durable Objects + R2 + D1, Trigger.dev V3, DigitalOcean PostgreSQL, Neon/Supabase, Mailgun, Stripe (metered usage), Airtable REST + Webhooks API, Google Drive / Dropbox / Box / OneDrive / S3 / Frame.io OAuth or IAM clients.
- **Cross-service contract** with front (`baseout-web`): `/runs/{id}/start`, `/restores/{id}/start`, `wss://.../spaces/{id}/progress`, `/inbound/{type}` ingestion, `/spaces/{id}/schema|changelog|restore-bundle` reads, all using shared HMAC service tokens.
- **Master DB writes**: `backup_runs`, `backup_run_bases`, `restore_runs` (status only), `space_databases`, `airtable_webhooks`, `notification_log`, `credit_transactions`, `cleanup_runs`, `organization_restore_usage`, `organization_credit_balance`. Schema package `@baseout/db-schema` is consumed (not redefined — owned by front).
- **Secrets**: master encryption key, Trigger.dev key, Cloudflare API token, Stripe key, Mailgun (back-scoped), service-to-front HMAC, OAuth client secrets for each storage provider.
- **Operational**: a single `wrangler.toml` per environment with multiple cron triggers, route bindings (one per public hostname), DO bindings, and R2/D1 bindings; Logpush + tail Workers, on-call alert routing, quarterly service-token rotation, annual DB credential rotation, super-admin audit log retention (24 months recommended).
