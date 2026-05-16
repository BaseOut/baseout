## Why

`server` is the data-plane Cloudflare Worker. It owns the per-Connection rate-limit gateway, the per-Space scheduler, the HTTP entry points that `apps/web` calls (via service binding, never public HTTP), the cron handlers that fit inside a Worker's wall-clock budget, the master-DB mirror schemas for tables it reads/writes, and the enqueue path that hands long-running work off to `apps/workflows`'s Trigger.dev tasks. It is one of two halves of Baseout's data plane (the other is `apps/workflows/`, scoped by [`workflows`](../workflows/proposal.md)); together they execute customer backups, restores, schema diffs, BYOS writes, retention sweeps, and quota accounting.

This change is the umbrella proposal for the apps/server side of the data plane. Concrete sub-changes (`server-attachments`, `server-retention-and-cleanup`, `server-instant-webhook`, `server-dynamic-mode`, etc.) own per-feature scope. This change captures the app boundary, the shared cross-app contract, and the capability set the data plane exposes — independent of the Trigger.dev task topology that lives next door.

## What Changes

- Establish `apps/server/` as a standalone Cloudflare Workers project, deployed independently. Hosts:
  - **Durable Objects**: `ConnectionDO` (per-Connection rate-limit gateway with lock + Airtable API budget) and `SpaceDO` (per-Space scheduler, run-state holder, future WebSocket broadcast hub).
  - **HTTP surface**: public `/api/health` (liveness probe only) plus INTERNAL_TOKEN-gated `/api/internal/*` reachable from `apps/web` (and sibling Workers) via Cloudflare service binding.
  - **Cron handlers** for work that fits in the Worker's wall-clock budget (OAuth refresh, webhook renewal, dead-connection cadence, connection-lock manager, plus future quota/cleanup-dispatch passes). Anything that exceeds the budget gets enqueued as a Trigger.dev task in `apps/workflows/`.
  - **Master-DB mirrors** for tables the engine reads or writes: `backup_runs`, `backup_run_bases`, `restore_runs` (when restore ships), `backup_configurations`, `backup_configuration_bases`, `connections`, `spaces`, `airtable_webhooks`, `notification_log`, etc. Canonical migrations are owned by `apps/web/`; the server mirrors only what it touches.
  - **Trigger.dev enqueue path** in `src/lib/trigger-client.ts`, with type-only references to task definitions exported from `@baseout/workflows`.
- Defer **task execution**, **CSV streaming**, **storage writers**, **Airtable record fetch + create batching**, **attachment streaming**, **dynamic-mode DB upserts**, and **schema-diff computation per table** to `apps/workflows/` — see [`workflows`](../workflows/proposal.md).
- Defer the **public Airtable webhook receiver** to [`apps/hooks/`](../hooks/proposal.md), the **public inbound API** to [`apps/api/`](../api/proposal.md), and the **public SQL endpoint** to [`apps/sql/`](../sql/proposal.md). Apps/server never serves a public route except `/api/health`.
- Defer **customer auth**, **Stripe webhook handling**, **billing UI**, **OAuth Connect flows**, **`/ops` console**, and **master-DB schema ownership** to `apps/web/`.

## Capabilities

### New Capabilities

- `backup-engine` (Worker side): The Worker-side entry point for backups — `/api/internal/runs/{id}/start` fans out one Trigger.dev `backup-base` task per included base, `/api/internal/runs/{id}/progress` and `/complete` aggregate the workflows-side callbacks into `backup_runs`, `/api/internal/runs/{id}/cancel` drives the cancel state machine via `tasks.runs.cancel`. The task body itself (record fetch, CSV stream, storage write) lives in `apps/workflows/`.
- `restore-engine` (Worker side): Same shape as the backup-engine entry points, scoped to `restore_runs`. Implementation deferred to [`server-restore`](../server-restore/proposal.md) (paired with [`workflows-restore`](../workflows-restore/proposal.md)).
- `storage-destinations`: The `StorageDestination` master-DB row, the per-Space resolve helper invoked over engine-callback (`/api/internal/spaces/:id/storage-destination`), and the per-provider OAuth Connect flows on `apps/web`. The runtime `StorageWriter` interface implementations live in `apps/workflows/`.
- `database-provisioning`: On-demand client DB provisioning across D1, Shared PG, Dedicated PG, and BYODB; tier-migration flow with grace-period decommission. The Trigger.dev `provision-space-database` task that invokes the dispatcher lives in `apps/workflows/`.
- `schema-diff`: Schema diff + changelog computation per run, human-readable rendering endpoint, and health-score computation per Base from configurable rules. The per-table diff computation hook in the backup-base task lives in `apps/workflows/`.
- `airtable-webhook-coalescing`: Per-Space DO event coalescing of forwards from `apps/hooks/`, cursor advancement on `airtable_webhooks`, gap-detection + full-table re-read fallback, and webhook lifecycle (registration on Instant Backup enable, hourly renewal cron owned by [`server-cron-webhook-renewal`](../server-cron-webhook-renewal/proposal.md)).
- `background-services` (Worker-resident crons): Cron-triggered handlers that fit in the Worker's wall clock — OAuth refresh, webhook renewal, dead-connection cadence, connection-lock manager. Longer-running cron-shaped work (cleanup, trial-email, credit alerts) is enqueued as Trigger.dev scheduled tasks in `apps/workflows/`.
- `direct-sql-access`: Read-only PostgreSQL connection string surfacing (via internal endpoint to `apps/web`) for Business+ tiers with periodic credential rotation and dual-validity overlap. BYODB customers get a no-op notice.
- `backup-credit-consumption`: `credit_transactions` writes for `apps/server`-executed operations (and aggregated workflows-side reports), bucket-priority debiting, mid-run overage-cap pause behavior, and direct Stripe metered-usage reporting at period close. Owned by [`server-manual-quota-and-credits`](../server-manual-quota-and-credits/proposal.md).
- `backup-email-notifications`: React Email templates rendered + dispatched server-side via the Cloudflare Workers `send_email` binding (the same transport `apps/web` uses today — see [`apps/web/src/lib/email/send.ts`](../../../apps/web/src/lib/email/send.ts)), for `apps/server`-owned email categories (backup audit, failure/warning, trial cap, trial expiry, dead-connection cadence, quota warning, overage, schema change, health score change, restore complete, webhook renewal failure). Templates live in `apps/server/src/emails/`.
- `on2air-migration-script`: One-shot manually-invoked entry point in `apps/server/src/migration/` that reads the legacy On2Air DB, maps customers to Baseout tiers, creates Baseout organizations and Stripe subscriptions, re-encrypts persisted secrets under AES-256-GCM, grants migration credits, and supports dry-run + idempotent re-run.

### Modified Capabilities

None — this is the umbrella proposal for the initial `apps/server` implementation. Concrete capability deltas land via sibling sub-changes.

## Cross-app contract

```
                                                       master-DB (Postgres)
                                                            ▲
                                                            │ (per-request postgres-js)
browser ─https/wss──> apps/web ───service-binding───> apps/server
                       │                                 │  ▲
                       │                                 │  │ /api/internal/runs/:id/{progress,complete}
                       │                                 │  │ (engine-callback)
                       │                                 ▼  │
                       │                       tasks.trigger<typeof X>(...)
                       │                                 │
                       │                                 ▼
                       │                       apps/workflows (Trigger.dev runner, Node)
                       │                       backup-base, restore-base, cleanup,
                       │                       provision-space-database, etc.
                       │
                       ├─ apps/hooks  ──service-binding──> apps/server  /api/internal/airtable-webhook-event
                       ├─ apps/api    ──service-binding──> apps/server  /api/internal/inbound/:type
                       └─ apps/sql    ──Hyperdrive──> client DB (read-only)
                                                  ↑
                                                  │ provisioned by apps/server (database-provisioning capability)
```

- **Auth**: `apps/web` is the only customer-facing entry. The browser never sees `apps/server`. Service-to-service calls carry an `x-internal-token` header byte-equal to `INTERNAL_TOKEN` on the apps/server side ([`apps/server/src/middleware.ts`](../../../apps/server/src/middleware.ts)). This is defense-in-depth atop the network-level isolation that Cloudflare service bindings provide.
- **Master DB ownership**: schema migrations land in `apps/web/drizzle/`. apps/server mirrors only the tables it reads/writes, with header comments naming the canonical migration owner.
- **Encryption**: OAuth refresh tokens, access tokens, and BYOS provider credentials are AES-256-GCM encrypted with a shared master key (`BASEOUT_ENCRYPTION_KEY`), held identically by `apps/web` (encryptor) and `apps/server` (decryptor).

## Impact

- **Workspace package**: `apps/server/` (`@baseout/server`). Independent `package.json`, `tsconfig.json`, `vitest.config.ts`, `wrangler.jsonc`.
- **Consumed packages**: `@baseout/db-schema` (Drizzle), `@baseout/shared` (crypto, error types, Zod helpers), `@baseout/workflows` (type-only for `tasks.trigger`).
- **Runtime deps**: `@trigger.dev/sdk` (enqueue path only), `drizzle-orm`, `postgres`.
- **External dependencies**: Cloudflare Workers + Durable Objects + Hyperdrive + R2 (when BYOS R2-managed lands) + D1 (for the database-provisioning D1-tier path) + Cloudflare Email Workers `send_email` binding (email transport), Trigger.dev V3 (project ref pinned in `apps/workflows/trigger.config.ts`), DigitalOcean PostgreSQL (master DB + shared PG for Pro tier client DBs), Neon/Supabase (Dedicated PG), Stripe (metered usage), Airtable REST API, Google Drive / Dropbox / Box / OneDrive / S3 / Frame.io OAuth or IAM clients (refresh + delegated calls in apps/server; actual byte writes in apps/workflows).
- **Master DB writes**: `backup_runs`, `backup_run_bases`, `restore_runs`, `space_databases`, `airtable_webhooks`, `notification_log`, `credit_transactions`, `cleanup_runs`, `organization_restore_usage`, `organization_credit_balance`. Schema package `@baseout/db-schema` is consumed (not redefined — owned by `packages/db-schema/`).
- **Secrets**: `INTERNAL_TOKEN`, `BASEOUT_ENCRYPTION_KEY`, `DATABASE_URL` (local dev) / `HYPERDRIVE` binding (deployed), `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, `MAILGUN_API_KEY` (when emails ship), `STRIPE_SECRET_KEY` (when metered usage ships), per-platform OAuth client secrets (Airtable, Google Drive, Dropbox, Box, OneDrive, S3, Frame.io) as they land.
- **Operational**: one `wrangler.jsonc` per environment with multiple cron triggers (mostly commented out until each sub-change activates them), DO bindings, R2 / D1 bindings (when applicable), Hyperdrive binding for master DB. Logpush + tail Workers, on-call alert routing, quarterly INTERNAL_TOKEN rotation, annual DB credential rotation.

## Out of Scope

- **Trigger.dev task definitions, helpers, and tests** — see [`workflows`](../workflows/proposal.md).
- **Public webhook receiver** — [`hooks`](../hooks/proposal.md).
- **Public inbound API** — [`api`](../api/proposal.md).
- **Public SQL endpoint** — [`sql`](../sql/proposal.md).
- **Customer auth, OAuth Connect, billing UI, dashboard** — [`web`](../web/proposal.md).
- **Internal admin surfaces** — [`admin`](../admin/proposal.md).
- **Master-DB schema definitions and migrations** — `apps/web/drizzle/` is canonical; this app mirrors only.
