## Why

`baseout-backup` is the data plane of Baseout: it executes customer backups, holds rate-limited Airtable connections open across long workflows, persists captured data into client databases, computes schema diffs and health scores, runs the cron-based background services that keep webhooks renewed and OAuth tokens fresh, and runs the one-shot On2Air migration script. None of it exists yet. This change converts the data-plane slice of the original `Back_PRD.md` (V1.0) into spec-driven OpenSpec artifacts, scoped to `baseout-backup` as one of six independently versioned and deployed runtime repos in the new container layout.

## What Changes

- Establish `baseout-backup` as a standalone Cloudflare Workers project at `apps/backup/`, deployed independently of every other Baseout repo. It hosts the backup engine, restore engine, Trigger.dev integration, Durable Objects, all background-service cron handlers, the database-provisioning code path, schema diff + health score computation, the post-receiver Airtable-webhook coalescing logic, and the On2Air migration script — but NOT the Airtable webhook public receiver (that's `baseout-webhook-ingestion`), the public Inbound API (that's `baseout-inbound-api`), or the public SQL REST API (that's `baseout-sql-rest-api`).
- Build the backup engine on Cloudflare Durable Objects (per-Connection rate-limit gateway + per-Space backup state machine) plus Trigger.dev V3 workflows (one job per base backup, unlimited concurrency).
- Implement static and dynamic backup modes with destination strategies for Cloudflare R2 (managed) plus six BYOS providers (Google Drive, Dropbox, Box, OneDrive, S3, Frame.io).
- Implement the restore engine with base-level / table-level / point-in-time scope and Community Restore Tooling AI-prompt bundles for Pro+.
- Provision client databases on demand across four tiers (D1 → Shared PG → Dedicated PG → BYODB) with tier-migration tooling.
- Compute schema diffs and health scores per backup run; expose them via internal read endpoints to `baseout-web` and `baseout-admin`.
- Coalesce verified Airtable webhook events received from `baseout-webhook-ingestion` into the per-Space DO; persist change-log batches; trigger incremental backup runs; manage cursor advancement, gap detection + fallback, and webhook lifecycle (registration on Instant Backup enable, renewal cron).
- Run seven cron-based background services (webhook renewal, OAuth refresh, dead-connection notification cadence, trial-expiry monitoring, quota monitoring, smart-cleanup scheduling, connection-lock manager) as cron handlers within the same Worker.
- Surface read-only Direct SQL connection strings (Business+) via an internal `baseout-web` read endpoint; manage periodic credential rotation.
- Implement the credit-consumption ledger for `baseout-backup`-executed operations (backup runs, restores, smart cleanup, AI doc generation persistence) and pause long-running backups mid-run when a dollar overage cap is reached. Report period-close metered usage to Stripe directly.
- Send `baseout-backup`-owned operational emails (audit reports, alerts, dead-connection cadence, quota warnings, etc.) via React Email + Mailgun, with `baseout-backup`'s own Mailgun key. Templates live in a single `src/emails/` directory.
- Run a one-shot On2Air migration script (read legacy DB → map to Baseout tiers → create orgs/Stripe subscriptions → re-encrypt secrets → grant migration credits → idempotent re-run) as a manually-invoked entry point in this repo.

## Capabilities

### New Capabilities

- `backup-engine`: Backup execution across static and dynamic modes, all trigger sources (scheduled cron handler, manual via `baseout-web`'s `/runs/{id}/start` call, webhook-driven via the per-Space DO coalescer), trial cap enforcement, attachment dedup, file path layout, and per-run audit reports.
- `restore-engine`: Restore execution to new bases or new tables in existing bases, point-in-time selection, post-restore verification (Growth+), Community Restore Tooling AI-prompt bundles (Pro+), and restore credit accounting.
- `storage-destinations`: Server-side write strategies for Cloudflare R2 plus BYOS Google Drive, Dropbox, Box, OneDrive, S3, and Frame.io behind a common `StorageWriter` interface.
- `database-provisioning`: On-demand client DB provisioning across D1, Shared PG, Dedicated PG, and BYODB; tier-migration flow with grace-period decommission.
- `schema-diff`: Schema diff + changelog computation per run, human-readable rendering endpoint, and health-score computation per Base from configurable rules.
- `airtable-webhook-coalescing`: Per-Space DO event coalescing of forwards from `baseout-webhook-ingestion`, cursor advancement on `airtable_webhooks`, gap-detection + full-table re-read fallback, and webhook lifecycle (registration on Instant Backup enable, renewal owned by the in-repo background service).
- `background-services`: Seven cron-triggered handlers within `baseout-backup` (webhook renewal, OAuth token refresh, dead-connection cadence, trial-expiry monitor, quota-usage monitor, smart-cleanup scheduler, connection-lock manager) running idempotently against `notification_log` for stateful flows.
- `direct-sql-access`: Read-only PostgreSQL connection string surfacing (via internal endpoint to `baseout-web`) for Business+ tiers with periodic credential rotation and dual-validity overlap. BYODB customers get a no-op notice.
- `backup-credit-consumption`: `credit_transactions` writes for `baseout-backup`-executed operations, bucket priority debiting, mid-run overage cap pause behavior, and direct Stripe metered-usage reporting at period close.
- `backup-email-notifications`: React Email + Mailgun templates and sends for `baseout-backup`-owned email categories (backup audit, failure/warning, trial cap, trial expiry, dead-connection cadence, quota warning, overage, schema change, health score change, restore complete, webhook renewal failure).
- `on2air-migration-script`: One-shot manually-invoked entry point in `baseout-backup` that reads the legacy On2Air DB, maps customers to Baseout tiers, creates Baseout organizations and Stripe subscriptions, re-encrypts persisted secrets under AES-256-GCM, grants migration credits, and supports dry-run + idempotent re-run.

### Modified Capabilities

None — this is the initial `baseout-backup` implementation. No prior specs exist in `openspec/specs/`.

## Impact

- **New repo**: `apps/backup/` — Cloudflare Workers project for the data plane.
- **Consumed packages**: `@baseout/db-schema` (Drizzle schema for the master DB).
- **External dependencies**: Cloudflare Workers + Durable Objects + R2 + D1, Trigger.dev V3, DigitalOcean PostgreSQL (master DB + shared PG for Pro tier client DBs), Neon/Supabase (Dedicated PG), Mailgun, Stripe (metered usage), Airtable REST API, Google Drive / Dropbox / Box / OneDrive / S3 / Frame.io OAuth or IAM clients.
- **Cross-repo contracts**:
  - With `baseout-web`: receives POSTs to `/runs/{id}/start` and `/restores/{id}/start`; emits live-progress events to `baseout-web`'s WebSocket clients via per-Space DO; serves read endpoints `/spaces/{id}/schema|changelog|restore-bundle`; writes status updates on `backup_runs` / `restore_runs`. All using shared HMAC service tokens.
  - With `baseout-webhook-ingestion`: receives forwarded webhook events at the per-Space DO via service binding (or HMAC-authenticated internal HTTP) — never exposes a public webhook receiver itself.
  - With `baseout-inbound-api`: receives forwarded validated Inbound API payloads at internal `/inbound/{type}` endpoints (HMAC service-token-authed); writes to client DBs.
  - With `baseout-sql-rest-api`: shares connection-pool / read-only role provisioning on the Pro+ shared PG and Dedicated PG instances; `baseout-sql-rest-api` queries the same client DBs `baseout-backup` provisions.
  - With `baseout-admin`: serves master DB reads and exposes manual admin actions (force backup, invalidate connection, reset trial, grant credits, force migration completion) via internal endpoints.
- **Master DB writes**: `backup_runs`, `backup_run_bases`, `restore_runs` (status only — `baseout-web` inserts), `space_databases`, `airtable_webhooks`, `notification_log`, `credit_transactions`, `cleanup_runs`, `organization_restore_usage`, `organization_credit_balance`. Schema package `@baseout/db-schema` is consumed (not redefined — owned by `packages/db-schema/`).
- **Secrets**: master encryption key, Trigger.dev key, Cloudflare API token, Stripe key, Mailgun (`baseout-backup`-scoped), service-to-`baseout-web` HMAC, OAuth client secrets for each storage provider, internal HMAC for receiving forwards from `baseout-webhook-ingestion` and `baseout-inbound-api`.
- **Operational**: a single `wrangler.jsonc` per environment with multiple cron triggers, route bindings (one per public hostname including the internal-call hostname), DO bindings, and R2/D1 bindings; Logpush + tail Workers, on-call alert routing, quarterly service-token rotation, annual DB credential rotation.
