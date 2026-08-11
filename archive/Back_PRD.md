# Baseout — Back PRD (Backup Engine, Background Services, Super-Admin)
**Version:** 1.0
**Date:** May 1, 2026
**Status:** Draft — Split from BaseOut_PRD_v2.md (V1.4)
**Scope:** Repos `baseout-backup-engine`, `baseout-background-services`, `baseout-admin`

> **Companion docs (cross-cutting, both PRDs reference):**
> - `../shared/Baseout_Features.md` — feature/capability matrix, naming dictionary, tier limits
> - `../shared/Master_DB_Schema.md` — Drizzle schema for the master DB
> - `../shared/Pricing_Credit_System.md` — pricing tiers, credit ledger, On2Air migration policy
>
> **Companion PRD:** `../front/Front_PRD.md` — Astro web app, web API endpoints, Inbound API, Stripe webhook handler, auth.

---

## Table of Contents

1. [Vision & Boundary](#1-vision--boundary)
2. [Repos & Service Boundary](#2-repos--service-boundary)
3. [Architecture & Tech Stack](#3-architecture--tech-stack)
4. [Backup Engine](#4-backup-engine)
5. [Restore Engine](#5-restore-engine)
6. [Storage Destinations (Server-Side)](#6-storage-destinations-server-side)
7. [Database Provisioning & Migration](#7-database-provisioning--migration)
8. [Schema Diff & Changelog](#8-schema-diff--changelog)
9. [Airtable Webhook Ingestion](#9-airtable-webhook-ingestion)
10. [Background Services](#10-background-services)
11. [SQL REST API](#11-sql-rest-api)
12. [Direct SQL Access](#12-direct-sql-access)
13. [Credit Consumption (Back-Owned Operations)](#13-credit-consumption-back-owned-operations)
14. [Email Templates (Back-Owned)](#14-email-templates-back-owned)
15. [Super-Admin App (`baseout-admin`)](#15-super-admin-app-baseout-admin)
16. [Cross-Service Contract](#16-cross-service-contract)
17. [On2Air Migration Script](#17-on2air-migration-script)
18. [Testing](#18-testing)
19. [Git Branching, Environments & CI/CD](#19-git-branching-environments--cicd)
20. [Security, Secrets & Encryption](#20-security-secrets--encryption)
21. [Database Access (Master DB + Client DBs)](#21-database-access-master-db--client-dbs)
22. [Observability](#22-observability)
23. [Open Questions](#23-open-questions)

---

## 1. Vision & Boundary

> **"Baseout is the backup, restore, and data intelligence layer for Airtable — giving platform admins real-time protection, schema visibility, and direct SQL access to their own data."**

This PRD covers everything that runs without a user clicking on it: the backup engine and the workflows it spawns, the restore engine, the cron-based background services, the Airtable webhook ingestion endpoint, the SQL REST API for customer-facing queries, the on-demand database provisioning, the schema-diff/changelog computation, and the super-admin app used by Baseout staff.

**It does not cover** marketing pages, the customer dashboard, auth flows, the Stripe webhook handler, the Inbound API, or the React Email templates that sign-up/billing/migration flows send — those live in the front PRD.

**The boundary in one sentence:** if it runs on a schedule, processes a queue, executes a long workflow, holds open a connection over a backup run's lifetime, or is operator-only tooling, it is back. If it has to respond to a user click within 1–2 seconds inside an Astro page, it is front.

See `../shared/Baseout_Features.md` §1 for the canonical naming dictionary and §1.2 for V1 positioning.

---

## 2. Repos & Service Boundary

| Repo | Description | Deploy Target |
|---|---|---|
| `baseout-backup-engine` | Backup execution, restore execution, schema diff, Airtable webhook ingestion, SQL REST API, database provisioning. Built on Cloudflare Durable Objects + Trigger.dev workflows | Cloudflare Workers |
| `baseout-background-services` | Cron workers — webhook renewal, OAuth refresh, dead-connection notification cadence, trial expiry monitor, quota usage monitor, smart-cleanup scheduler, On2Air migration script | Cloudflare Workers (cron-triggered) |
| `baseout-admin` | Super-admin Astro app — internal-only operational dashboard | Cloudflare Pages + Workers (separate project, separate auth) |

`baseout-admin` lives in this PRD because its concerns are operational: viewing all Organizations and runs, DB provisioning oversight, connection health, background-service status, error logs, force-trigger admin actions. It consumes `baseout-ui` (owned by front) as a dependency.

**Owned by back:**
- All backup execution paths (static + dynamic; scheduled + manual + webhook-triggered)
- All restore execution paths
- All cron-based background services
- The Airtable webhook receiver endpoint
- The SQL REST API
- Database provisioning logic (D1 → Shared PG → Dedicated PG → BYODB) and tier migration tooling
- Storage destination clients (R2, Google Drive, Dropbox, Box, OneDrive, S3, Frame.io) — server-side write logic
- Schema diff and changelog computation
- Health-score computation
- Credit consumption for back-executed operations (backup runs, restores, smart-cleanup manual triggers, SQL REST queries)
- React Email templates for the email categories listed in §14
- The super-admin app
- The On2Air migration script

**Not owned by back:**
- Marketing / public pages, dashboard, settings, auth (all front)
- Stripe webhook handler (front)
- Inbound API (front; back exposes an internal ingestion endpoint that front forwards to)
- Front-owned email templates (auth, sign-up, billing, migration welcome — see Front PRD §14)
- Drizzle schema definition (front owns; back imports `@baseout/db-schema`)

---

## 3. Architecture & Tech Stack

| Layer | Decision |
|---|---|
| Runtime | Cloudflare Workers |
| Stateful units | Cloudflare Durable Objects — per-Connection (rate-limit gateway) and per-Space (backup state) |
| Job queue / workflows | Trigger.dev V3 (cloud) — one job per base backup; unlimited concurrent; no time limits |
| Real-time emitter | Durable Objects publish WebSocket events to front |
| ORM | Drizzle, via `@baseout/db-schema` package owned by front |
| Master DB | DigitalOcean PostgreSQL (read + write) |
| Client DBs | Cloudflare D1, Shared PostgreSQL on DigitalOcean, Dedicated PostgreSQL (Neon / Supabase / DO), customer-hosted PostgreSQL (BYODB) |
| File storage | Cloudflare R2 (managed); plus customer storage destinations for static backups |
| Email rendering | React Email |
| Email send | Mailgun SDK (own API key separate from front) |
| `baseout-admin` framework | Astro SSR + Tailwind + DaisyUI + `baseout-ui` |
| Monitoring | Cloudflare Workers Analytics + tail Workers + Logpush; Trigger.dev dashboard for job-level state |
| Testing | Vitest, Miniflare via `@cloudflare/vitest-pool-workers` |

**Service architecture from the back's point of view:**

```
[Airtable REST API + Webhooks]
          │
          ▼
[Cloudflare Durable Object — per Connection]
          │   Rate-limit gateway; queues API calls; OAuth token holder
          │
          ▼
[Cloudflare Durable Object — per Space]
          │   Backup state machine; cron-like controller; emits live progress
          │
          ▼
[Trigger.dev Workflows] ← one per base backup; parallel; no time limits
          │
          ├──► [Master DB — DigitalOcean PostgreSQL]   ← run/restore metadata, credit ledger
          ├──► [Client DB] ← schema/records/etc. (D1 or PG)
          ├──► [Cloudflare R2] ← attachments + static CSV files (managed)
          └──► [Customer Storage Destination] ← BYOS static backups (Drive, Dropbox, Box, OneDrive, S3, Frame.io)

[Cron Workers — baseout-background-services]
   ├── Webhook renewal (daily; renew at 6-day threshold)
   ├── OAuth token refresh
   ├── Dead-connection notification cadence
   ├── Trial expiry monitor
   ├── Quota usage monitor
   ├── Smart-cleanup scheduler
   └── On2Air migration (one-shot)

[Astro SSR — baseout-admin]
   ├── Reads master DB
   ├── Reads Trigger.dev runs
   └── Reads Cloudflare logs
```

The back never serves a customer-facing dashboard. Anything user-visible goes through front, except the SQL REST API (a programmatic API) and the super-admin app (Baseout-staff-only).

---

## 4. Backup Engine

### 4.1 Trigger Sources

| Trigger | Source | Repo |
|---|---|---|
| Scheduled (monthly / weekly / daily) | Cron in `baseout-background-services` writes a `backup_runs` row and calls back's `/runs/{id}/start` | back |
| Manual (Run-Now button) | Front writes `backup_runs` row and calls `/runs/{id}/start` | back receives |
| Webhook-driven (Instant Backup) | Airtable webhook ingestion endpoint → DO emits change events → coalesce into incremental run | back |

### 4.2 Backup Modes

| Mode | Description | Storage | Tiers |
|---|---|---|---|
| **Static** | Stream Airtable data → CSV/JSON in memory → write to Storage Destination | Cloudflare R2 (managed) or BYOS destination | All |
| **Dynamic (Schema Only)** | Schema metadata only → D1 | Baseout D1 | Trial, Starter |
| **Dynamic (Full)** | Schema + records + attachments → D1 / Shared PG / Dedicated PG / BYODB | Customer-provisioned client DB | Launch+ |

> On static plans using BYOS, **no record data ever lands on Baseout disk** — it streams through memory directly to the destination. This is a privacy differentiator. On dynamic plans, customers explicitly opt into Baseout-hosted storage.

### 4.3 Durable Object Topology

| DO | Purpose | Lifetime |
|---|---|---|
| **Per-Connection DO** | Rate-limit gateway for the underlying Airtable account; OAuth token holder; queues API calls so Airtable's per-account rate limits are respected across simultaneous Spaces | Long-lived; one per `connections.id` |
| **Per-Space DO** | Backup state machine (`idle → running → success/failed`); cron-like scheduler; lock holder for the connection during a run; live-progress event publisher | Long-lived; one per `spaces.id` |

Per-Connection DOs serialize API calls when multiple Spaces share a Connection. Per-Space DOs handle the actual backup orchestration.

### 4.4 Trigger.dev Workflows

One Trigger.dev job per base backup. Allows unlimited concurrent runs and no time limits per run. Each job:

1. Acquires a connection lock via the per-Connection DO (5-second retry on contention).
2. Streams Airtable schema → writes to client DB (or stages in memory for static).
3. Streams records page-by-page → writes to client DB / streams CSV to destination.
4. Streams attachments → writes to R2 / streams to BYOS destination (Box/Dropbox via proxy stream).
5. Updates `backup_run_bases` per base; emits progress events to per-Space DO.
6. Releases connection lock.
7. Records final status in `backup_runs`.

### 4.5 Trial Cap Enforcement

Trial runs (`is_trial=true`) stop at:
- 1,000 records total across all tables
- 5 tables max
- 100 attachments max

When a cap is hit:
- Mark `backup_runs.status = 'trial_complete'`
- Set `subscription_items.trial_backup_run_used = true`
- Notify user (back-owned email — Trial Cap Hit)

Subsequent backup runs are blocked until the trial converts. The block is enforced at the run-start gate.

### 4.6 What Gets Backed Up

| Entity | Collection | Min Tier |
|---|---|---|
| Schema (Tables, Fields, Views) | Automatic via Airtable REST API | Starter |
| Records | Automatic | Starter |
| Attachments | Automatic; deduped by composite ID `{base}_{table}_{record}_{field}_{attachment}` | Starter |
| Automations | Manual via Inbound API (front forwards to back) | Growth |
| Interfaces | Manual via Inbound API | Growth |
| Custom Documentation | Manual via Inbound API | Pro |

### 4.7 Attachment Handling

- Composite unique ID per attachment.
- Deduplication check before processing — if the attachment already exists in storage with the same ID, skip.
- Proxy streaming for destinations that require it (Box, Dropbox).
- Airtable attachment URLs expire in ~1–2 hours — the engine refreshes URLs as needed mid-run.

### 4.8 File Path Structure (Static Backups)

```
/{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv
```

`{user-root}` is the destination's root (a folder for OAuth destinations, a bucket+prefix for S3/R2).

### 4.9 Webhook-Based Incremental Backup (Pro+)

- Ingest Airtable webhooks for record create/update/delete and schema events.
- Per-Space change-log table (in client DB) records every webhook event with cursor.
- Scheduled coalescer job batches recent change events into an incremental run.
- Fall back to full-table re-read if a webhook gap is detected (`last_known_cursor` → current).
- Webhook lifecycle (registration, renewal, expiry) covered in §9.

### 4.10 Backup Auditing

| Output | Destination |
|---|---|
| Per-run audit report (counts, errors, skipped) | Stored in master DB (`backup_runs`) + client DB audit log table |
| Per-entity verification | `backup_run_bases` rows |
| Issue notifications | Email (back) + in-app (master DB `notifications`) |
| Monthly Backup Summary | Cron-generated digest email (back) |
| Detailed audit logs | Client DB; retention by tier (90d Launch → 24mo Business → custom Enterprise) |

---

## 5. Restore Engine

### 5.1 Trigger

Front writes a `restore_runs` row with `status='pending'` and calls `/restores/{id}/start`. Back picks it up.

### 5.2 Scope

| Scope | V1 |
|---|---|
| Base-level restore | ✓ All tiers |
| Table-level restore | ✓ Starter+ |
| Point-in-time selection | ✓ All tiers (any snapshot in retention window) |
| Restore destination: new base | ✓ User provides Workspace ID; Baseout creates the base via Airtable API |
| Restore destination: existing base, new table | ✓ Starter+ |
| Restore destination: overwrite existing | ✗ Never — restore always creates new data |
| Record-level restore | ✗ Deferred (V1.1+) |
| Cross-base restore | ✗ Deferred |

### 5.3 Execution

A restore is a Trigger.dev workflow. Order:

1. Validate snapshot exists and is within retention.
2. Acquire connection lock.
3. If destination is new base: call Airtable API to create the base in the target Workspace.
4. Write tables in dependency order: tables → records → linked records → attachments.
5. Re-upload attachments from R2 / source destination to Airtable's attachment endpoint.
6. Run post-restore verification (Growth+): record count match, error count, audit log.
7. Update `restore_runs` with final status.
8. Send Restore Complete email (back).

### 5.4 Community Restore Tooling (Pro+)

For entities that cannot be automatically restored (Automations, Interfaces), back generates an AI-prompt bundle:

- The captured entity content (from client DB)
- A curated prompt template for Claude / ChatGPT
- Step-by-step instructions for the customer to execute the restoration manually via the Airtable API

The bundle is exposed via a back read endpoint that the front renders. Back generates and persists; front displays.

### 5.5 Restore Credit Accounting

Free restores (within `included_restores_per_month`) are tracked in `organization_restore_usage`. Excess restores debit credits per `../shared/Pricing_Credit_System.md` §8.6:

| Type | Credits |
|---|---|
| Table-level | 15 |
| Base (records only) | 40 |
| Base (records + attachments) | 75 |

---

## 6. Storage Destinations (Server-Side)

The OAuth/IAM auth flows for storage destinations are initiated from the front onboarding wizard. The actual write logic lives here.

| Destination | Auth | Proxy Required | Tiers |
|---|---|---|---|
| Cloudflare R2 (managed) | Internal | No | All |
| Google Drive | OAuth | No | All |
| Dropbox | OAuth | Yes | All |
| Box | OAuth | Yes | All |
| OneDrive | OAuth | No | All |
| Amazon S3 | IAM / Access Key | No | Growth+ |
| Frame.io | OAuth | TBD | Growth+ |
| Custom / BYOS | Varies | Varies | Pro+ |

Each destination has a strategy class implementing a common `StorageWriter` interface: `init`, `writeFile(stream, path)`, `getDownloadUrl(path)`, `delete(path)`. The engine writes to whichever destination is configured for the Space.

**Encryption:**
- R2 (managed): server-side encryption at rest, platform-managed.
- Customer destinations (Drive/Dropbox/Box/OneDrive/S3/Frame.io): provider-dependent. Disclosed in product docs.

---

## 7. Database Provisioning & Migration

### 7.1 Provisioning

Triggered when a Space first runs a Dynamic backup (or on Space upgrade to a tier that requires a new DB tier).

| Tier | Engine | Provisioning |
|---|---|---|
| Trial, Starter | D1 (schema only) | Cloudflare D1 — create database via Cloudflare API; record `space_databases.d1_database_id` |
| Launch, Growth | D1 (full) | Same |
| Pro | Shared PostgreSQL | DigitalOcean — create a schema (`org_{orgId}`) on a shared PG instance; record `space_databases.pg_schema_name` |
| Business | Dedicated PostgreSQL | Neon / Supabase / DigitalOcean — provision new DB instance; record encrypted connection string |
| Enterprise | BYODB | Customer provides connection string; back validates connectivity, schema-creates required tables |

State tracked in `space_databases.provisioning_status` (`pending` → `provisioning` → `active` → `migrating` → `error`).

### 7.2 Tier Migration

Required when a Space upgrades from a lower DB tier to a higher one (e.g., Growth → Pro = D1 full → Shared PG).

Flow:
1. Block scheduled backups for this Space (`is_active=false`).
2. Provision the new DB at the higher tier.
3. Stream data from old DB to new — schema first, then records, then change log.
4. Verify counts and key constraints.
5. Switch `space_databases` to the new tier.
6. Re-enable backups.
7. Decommission the old DB after a configurable grace period (default 7 days).

If migration fails: rollback (keep old DB active, alert engineering on-call).

### 7.3 BYODB

For Enterprise customers:
- Customer provides a PostgreSQL 13+ connection string (encrypted at rest in `space_databases.pg_connection_string_enc`).
- Back validates connectivity at provisioning time and on a periodic schedule.
- Back has write-access only — the customer manages backups, retention, and key management for their own DB.

---

## 8. Schema Diff & Changelog

After each backup run, back computes:

1. **Schema diff** — diff this run's schema against the previous run's schema. Output: structured changeset (added fields, removed fields, renamed fields, type changes, view changes).
2. **Persistence** — write to client DB schema-changelog table.
3. **Human-readable rendering** — back exposes a read endpoint that returns the diff as natural-language strings ("Field 'Status' changed from Single Select to Multiple Select on May 1"). Front consumes this endpoint.
4. **Notification** — if material changes, fire a `schema_change` notification (back-owned email).

For Instant Backup customers, schema diffs are computed on each webhook-triggered incremental run.

**Health Score** is computed alongside the diff using the user-configured rules in `health_score_rules`. The score (0–100) and band (Green/Yellow/Red) is persisted per-Base and exposed to front for display.

---

## 9. Airtable Webhook Ingestion

A public Worker endpoint receives Airtable webhook callbacks.

| Aspect | Detail |
|---|---|
| Path | `POST /webhooks/airtable/{webhook_id}` |
| Auth | Airtable's webhook signature verification (HMAC) |
| Action | Look up `airtable_webhooks.airtable_webhook_id` → forward event to per-Space DO |
| DO behavior | DO appends to in-memory event queue; coalesces; persists change-log batches to client DB; triggers incremental backup run on configurable threshold |
| Webhook registration | Created when a Space enables Instant Backup (Pro+); registered against each included Base |
| Renewal | Background service renews at 6-day threshold (Airtable webhooks expire ~7 days) — see §10 |
| Cursor | Stored on `airtable_webhooks.cursor`; used to fetch any events missed during downtime |

---

## 10. Background Services

`baseout-background-services` is a set of cron-triggered Workers. Each cron runs idempotently and writes results to `notification_log` for stateful flows.

### 10.1 Webhook Renewal Service

- Runs daily.
- Scans `airtable_webhooks WHERE expires_at < now() + interval '24 hours'`.
- Calls Airtable webhook renewal API.
- Updates `last_successful_renewal_at` and `expires_at`.
- On failure: retries with backoff; after 3 failures, marks `is_active=false` and fires alert.

### 10.2 OAuth Token Refresh

- Runs every 15 minutes.
- Scans `connections WHERE token_expires_at < now() + interval '1 hour' AND status='active'`.
- Calls platform refresh endpoint (Airtable, Google, Dropbox, Box, OneDrive, Frame.io).
- Updates encrypted token columns.
- On failure: marks `status='pending_reauth'` and starts dead-connection cadence.

### 10.3 Dead-Connection Notification Cadence

When a connection moves to `pending_reauth`:

- **Send 1** — immediate
- **Send 2** — +2 days
- **Send 3** — +3 days (5 days total)
- **Send 4** (final) — +5 days (10 days total)
- After Send 4, mark `connections.status='invalid'`, set `invalidated_at`, and stop the cadence.

State tracked in `notification_log` (sent_count, last_sent_at, next_send_at). If the user re-authenticates at any point, `is_resolved=true` and `resolved_at` is set; cadence stops.

The actual email send is back-owned (§14).

### 10.4 Trial Expiry Monitor

- Runs hourly.
- Scans `subscription_items WHERE trial_ends_at IS NOT NULL`.
- **Day 5** (2 days before expiry): send Trial Expiry Warning email.
- **Day 7** (expiry): set `trial_ends_at < now()`; trigger Stripe to convert to paid (or mark as expired if no card on file); send Trial Expired email.

### 10.5 Quota Usage Monitor

- Runs hourly.
- For each Org, computes credits-consumed-this-period and storage-used.
- Fires `quota_75`, `quota_90`, `quota_100` notifications when thresholds cross. Each notification is one-shot per period (tracked in `notification_log`).
- Fires `overage` notification when overage starts accruing (via `is_overage=true` transactions).

### 10.6 Smart-Cleanup Scheduler

- Runs at the configured cleanup schedule per tier (Monthly / Weekly / Daily / Continuous).
- For each Space, evaluates the cleanup policy (Basic / Time-based / Two-tier / Three-tier / Custom) and deletes snapshots beyond the retention window.
- Records run in `cleanup_runs` with `trigger_type='scheduled'`, `credits_used=0`.

### 10.7 Connection Lock Manager

A small DO-based service ensuring no two backup or restore runs hit the same Airtable Connection simultaneously. Lock held in-memory in the per-Connection DO with a 5-second retry budget for contending callers.

---

## 11. SQL REST API

A custom Cloudflare Worker (not PostgREST) exposes read-only SQL REST access to a Space's dynamic DB. Available on Pro+.

| Aspect | Detail |
|---|---|
| Path | `https://sql.baseout.com/v1/spaces/{space_id}/query` |
| Auth | Bearer token from `api_tokens` (same table as Inbound API tokens; per-Space scope) |
| Method | `POST` with JSON body: `{ query: "SELECT ...", params: [...] }` |
| Read-only | Enforced by issuing a read-only DB role and parsing the query |
| Parameterization | All user-supplied values must use parameters; raw concatenated SQL is rejected |
| Rate limits | 10K queries/mo (Pro), 50K (Business), Unlimited (Enterprise) |
| Credit consumption | 1 credit per 50 queries |
| Response | JSON `{ rows: [...], row_count: N }` with size cap (default 10MB per response) |
| Documentation | OpenAPI spec at `docs.baseout.com` |

> **Decision (resolved):** custom Worker, not PostgREST. Reason: better control over query parsing, rate limiting, credit consumption, and connection pooling. PostgREST adds operational complexity and was rejected during V1 spec lock.

---

## 12. Direct SQL Access

Available on Business and Enterprise tiers. The customer is given a **read-only PostgreSQL connection string** to their dedicated DB. Back's role:

- Provision a dedicated read-only role on the customer's DB during DB provisioning.
- Surface the connection string via a front read endpoint (decrypted on-demand, never logged).
- Periodic credential rotation (configurable; default 90 days). On rotation, both the old and new credential are valid for 7 days, then the old is revoked.

Direct SQL is **not metered with credits** (it bypasses Baseout entirely once the connection is open), but DB-level connection limits and slow-query timeouts are enforced.

For Enterprise BYODB customers, Direct SQL is irrelevant — the customer already owns the DB.

---

## 13. Credit Consumption (Back-Owned Operations)

Back is responsible for writing `credit_transactions` rows for the following operations:

| Operation | Credits |
|---|---|
| Schema/metadata backup | 5 per base, per run |
| Record data transfer | 1 per 1,000 records |
| Attachment data transfer | 1 per 50 MB |
| Restore — table | 15 per (excess) |
| Restore — base records | 40 per (excess) |
| Restore — base records + attachments | 75 per (excess) |
| Smart cleanup — manual trigger | 10 per |
| SQL REST query | 1 per 50 queries |
| AI schema insight | 5 per (when AI Insights ships in V2) |

Back follows the consumption logic in `../shared/Pricing_Credit_System.md` §8.3:

1. Compute total credits owed.
2. Load active buckets sorted by expiration.
3. Debit from each bucket in order, recording transactions.
4. If buckets exhausted, check overage cap; if `cap` mode and cap reached, **refuse the operation** and notify (otherwise accumulate as overage).
5. Update `organization_credit_balance` cache.

The overage-cap-pause behavior must apply mid-backup-run as well: if a long-running backup crosses the cap mid-run, the run is paused (`status='paused'`), and the user is notified to raise the cap, buy credits, or upgrade.

> **Note:** Back never bills Stripe directly. Overage accumulation is recorded in transactions; front's Stripe webhook handler (or a back-side end-of-period cron that calls Stripe metered usage API) reports usage to Stripe at period close. **Recommended ownership:** back's quota monitor reports period-close metered usage to Stripe via the Stripe API directly (back already has the credentials for `customer.subscription.report_usage` calls). This avoids cross-side coordination at period boundaries.

---

## 14. Email Templates (Back-Owned)

All templates use **React Email** + **Mailgun**. Back owns and sends the following:

| Template | Trigger | Service |
|---|---|---|
| Backup Audit Report | Per audit run (configurable frequency) | Backup engine |
| Monthly Backup Summary | Monthly cron | Background services |
| Backup Failure Alert | Backup run fails | Backup engine |
| Backup Warning Alert | Backup completes with warnings | Backup engine |
| Trial Cap Hit | Trial run hits a record/table/attachment cap | Backup engine |
| Trial Expiry Warning | Day 5 of trial | Background services (trial monitor) |
| Trial Expired | Day 7 of trial | Background services (trial monitor) |
| Dead Connection Warning ×4 | Cadence per §10.3 | Background services |
| Quota Warning (75/90/100%) | Quota threshold crossed | Background services |
| Overage Started | Overage credits accrue | Background services |
| Overage Cap Reached | Cap-mode dollar cap hit | Backup engine + background services |
| Schema Change Notification | Material schema diff after backup | Backup engine |
| Health Score Change | Score moves between bands | Backup engine |
| Restore Complete | Restore engine finishes | Restore engine |
| Webhook Renewal Failure | Webhook renewal fails 3× | Background services |

**Sending domain:** `mail.baseout.com` (DKIM/SPF/DMARC). Mailgun API key is held in Cloudflare Secrets for back, separately from front's key. Back **does not** call front to send emails — both sides call Mailgun directly. (This is a deliberate split from the original PRD §19.2; emails are now owned by the side with the trigger.)

Templates live under `baseout-backup-engine/src/emails/` and `baseout-background-services/src/emails/`. They are **not** shared across repos — duplication is acceptable; if it becomes painful, factor into an internal `@baseout/email-templates` package later.

---

## 15. Super-Admin App (`baseout-admin`)

A separate Astro application accessible only to Baseout staff. Deployed to a separate Cloudflare Pages project with its own auth.

### 15.1 Capabilities

| Section | What |
|---|---|
| Organization browser | All Orgs; search/filter; per-Org drill-in |
| Subscription dashboard | All subscriptions, statuses, MRR view |
| Backup run viewer | All runs across all Orgs; filter by status, time window |
| Database provisioning tracker | All D1 / Shared PG / Dedicated PG / BYODB instances; utilization; health |
| Connection health dashboard | OAuth connections by status; webhook renewal state |
| Background-service monitor | Last run time and success/failure for each cron service |
| On2Air migration status | Migrated vs. pending counts; per-customer migration state |
| Manual admin actions | Force backup; invalidate connection; reset trial; adjust plan; grant credits; force migration completion |
| Error log search | Query Cloudflare logs / Logpush destination |
| Audit trail | Internal audit log of admin actions |

### 15.2 Auth

- Separate from customer-facing auth (different `users` namespace).
- SSO-only (Google Workspace) for Baseout staff.
- All admin actions logged in an immutable audit table.

### 15.3 UI

- Built with `baseout-ui` (the front-owned shared component library) + Tailwind + DaisyUI.
- Astro SSR for fast page loads; React islands for live data.
- Reuses Drizzle queries from `@baseout/db-schema`.

---

## 16. Cross-Service Contract

(Mirror of Front PRD §17 — both PRDs document the same contract from their side.)

### 16.1 Triggering Backups

Front writes `backup_runs` row → POSTs to `{BACKUP_ENGINE_URL}/runs/{run_id}/start` with `Authorization: Bearer {SERVICE_TOKEN}`. Back acknowledges 200, enqueues Trigger.dev job, updates `status='running'`.

### 16.2 Triggering Restores

Same pattern: front writes `restore_runs` → POSTs to `/restores/{id}/start`.

### 16.3 Live Progress (WebSocket)

Per-Space DO accepts WebSocket connections at `wss://{BACKUP_ENGINE_URL}/spaces/{space_id}/progress`. Auth via session cookie or short-lived token issued by front. Events:

| Event | Payload |
|---|---|
| `run_started` | `{ run_id, base_count }` |
| `base_started` | `{ run_id, base_id, base_name }` |
| `progress_pct` | `{ run_id, base_id, pct, records_done, records_total }` |
| `base_completed` | `{ run_id, base_id, status, record_count, attachment_count }` |
| `run_completed` | `{ run_id, status, totals }` |
| `error` | `{ run_id, base_id?, error_message }` |

### 16.4 Inbound API Forwarding

Front receives a customer's Inbound API call, validates auth and rate limits, then POSTs to back's internal ingestion endpoint:

`POST {BACKUP_ENGINE_URL}/inbound/{type}` with the validated payload + `space_id` + service token.

Back writes to the client DB and returns a write confirmation. Front returns the result to the customer.

### 16.5 Schema / Data Reads

Back exposes read endpoints that front uses for capabilities like Schema Visualization, changelog rendering, and Community Restore Tooling:

| Endpoint | Returns |
|---|---|
| `GET /spaces/{id}/schema` | Latest schema metadata |
| `GET /spaces/{id}/schema/changelog?since=...` | Diff entries |
| `GET /spaces/{id}/restore-bundle/{run_id}` | AI-prompt bundle for Community Restore Tooling |

### 16.6 Service Authentication

All cross-service calls (front↔back, in either direction) use HMAC-signed `Authorization: Bearer {SERVICE_TOKEN}` headers. Token rotated via Cloudflare Secrets quarterly.

### 16.7 Email Sends

Each side calls Mailgun directly; no internal email-dispatch endpoint exists. Each side maintains its own templates per §14 of its PRD.

---

## 17. On2Air Migration Script

A one-shot script run before public launch.

| Phase | Task |
|---|---|
| **Read** | Read all On2Air customer records from the legacy DB |
| **Map** | Map each customer to a Baseout tier per `../shared/Pricing_Credit_System.md` §5 |
| **Create** | Create Baseout `organizations` rows; create Stripe customers + subscriptions; populate `subscription_items` with the mapped tier; set `organizations.dynamic_locked=true` and `has_migrated=false` |
| **Decrypt + re-encrypt** | For any persisted backup metadata, decrypt with legacy keys and re-encrypt under AES-256-GCM |
| **Grant migration credits** | Per `../shared/Pricing_Credit_System.md` §6: 2K (Bridge), 10K (Starter), 30K (Launch), 80K (Growth) |
| **Verify** | Sanity checks; manual review queue for failures |

The user-facing "Complete Your Migration" flow (re-auth Airtable, re-auth storage destinations) is owned by front (see Front PRD §22 / Front Plan Phase 7). This script populates the state that flow consumes.

The script lives in `baseout-background-services` as a one-shot worker (manually invoked, not on a cron).

---

## 18. Testing

| Layer | Tool |
|---|---|
| Unit + integration | Vitest |
| Cloudflare runtime | Miniflare via `@cloudflare/vitest-pool-workers` |
| Database | Local PG via Docker + Drizzle (real DB, not mocked); D1 via Miniflare |
| External APIs | Mocked at HTTP boundary via [msw](https://mswjs.io) |
| Trigger.dev jobs | Vitest + Trigger.dev test utilities; integration tests against Trigger.dev dev server |

**Back-specific test areas:**

| Area | What |
|---|---|
| Backup engine — backup logic | File path construction, CSV generation, attachment dedup ID, trial cap enforcement, per-entity status |
| Backup engine — restore logic | Snapshot selection, write ordering, error handling |
| Backup engine — Airtable client | Rate limit handling, retry, pagination, error responses, Enterprise vs standard scope |
| Backup engine — storage clients | R2, Google Drive, Dropbox proxy, Box proxy, OneDrive, S3, Frame.io — each with mocked provider |
| Backup engine — DO state | State transitions, lock acquire/release, cron-like scheduling |
| Restore engine | New base creation; existing base + new table; verification |
| Schema diff | Various diff scenarios; edge cases (renamed fields, type changes) |
| Health score | Each rule individually + composite |
| Webhook ingestion | Signature verification; cursor advancement; gap detection + full-read fallback |
| Background — webhook renewal | Threshold detection, renewal API, state update |
| Background — OAuth refresh | Expiry detection, refresh exchange, encrypted update |
| Background — dead connection | Cadence logic; sent count; resolution |
| Background — trial monitor | Day-5, day-7 transitions |
| Background — quota monitor | Threshold detection, one-shot semantics |
| Background — smart cleanup | Each policy tier (Basic, Time-based, Two-tier, Three-tier, Custom) |
| SQL REST API | Auth, rate limit, parameter parsing, read-only enforcement, response size cap |
| Credit consumption | Bucket priority, overage cap pause, transaction integrity |
| Migration script | Tier mapping logic; dry-run mode; idempotent re-run |

**Coverage targets:**
- `baseout-backup-engine`: 80%
- `baseout-background-services`: 80%
- `baseout-admin`: 60%

**Integration test scenarios:**

| Test | Components |
|---|---|
| Full static backup run | Engine + Airtable mock + R2 mock + master DB |
| Full dynamic backup run | Engine + Airtable mock + D1 (Miniflare) + master DB |
| Restore to new base | Restore engine + Airtable write mock + snapshot from DB |
| Webhook renewal cycle | Background service + Airtable webhook mock + DB |
| OAuth refresh cycle | Background service + provider OAuth mock |
| Trial expiry → Stripe convert | Trial monitor + Stripe mock + DB |
| Migration script | Source fixtures + master DB |

---

## 19. Git Branching, Environments & CI/CD

| Branch | Environment | Cloudflare Account |
|---|---|---|
| `main` | Production | Production CF account |
| `staging` | Staging | Staging CF account |
| `feature/*` | Preview | Production CF (preview URLs) |

Same conventions as front: `main` protected, PR-required, CI on every PR (Vitest + integration), `hotfix/*` cut from `main` and merged back to both.

**Repo-specific:**

- `baseout-backup-engine` deploys to Workers; cron triggers configured per environment.
- `baseout-background-services` deploys to Workers with cron triggers (one cron per service).
- `baseout-admin` deploys to Cloudflare Pages (separate project from `baseout-web`).

---

## 20. Security, Secrets & Encryption

| Secret (back-owned) | Where Stored |
|---|---|
| Airtable OAuth client secret | Cloudflare Secrets |
| Storage destination OAuth client secrets (Google, Dropbox, Box, OneDrive, Frame.io) | Cloudflare Secrets |
| Trigger.dev API key | Cloudflare Secrets |
| Master DB connection string | Cloudflare Secrets |
| Client DB connection strings (Shared PG, per-instance) | Cloudflare Secrets |
| Cloudflare API token (for D1 + R2 management) | Cloudflare Secrets |
| Stripe API key (for metered usage reporting) | Cloudflare Secrets |
| Master encryption key (AES-256-GCM) | Cloudflare Secrets — used to decrypt OAuth tokens + connection strings at runtime |
| Service-to-front HMAC key | Cloudflare Secrets — same key as front |
| Mailgun API key (back-scoped) | Cloudflare Secrets |
| `baseout-admin` SSO client secret | Cloudflare Secrets |

| Data | Encryption |
|---|---|
| Airtable + storage destination OAuth tokens | AES-256-GCM at rest in master DB |
| Customer DB connection strings (`pg_connection_string_enc`) | AES-256-GCM at rest |
| Backup data on R2 | Cloudflare R2 server-side encryption |
| Backup data on customer destinations | Provider-dependent |
| Customer DBs (Shared PG, Dedicated PG) | Provider-managed at-rest encryption |

**Operational security:**
- Service tokens rotated quarterly.
- DB credentials rotated annually (or on incident).
- All admin actions in `baseout-admin` write an audit row.

---

## 21. Database Access (Master DB + Client DBs)

### 21.1 Master DB

- Schema is owned by front (`baseout-web`); back imports `@baseout/db-schema`.
- Drizzle ORM for all reads/writes.
- Connection string in Cloudflare Secrets.

**Tables back writes to:**
`backup_runs`, `backup_run_bases`, `restore_runs` (status updates only — front inserts), `space_databases`, `airtable_webhooks`, `notification_log`, `credit_transactions`, `cleanup_runs`, `organization_restore_usage`, `organization_credit_balance`.

**Tables back reads:**
All others (organizations, spaces, connections, subscriptions, subscription_items, plan_definitions, plan_limits, plan_credit_config, credit_buckets, organization_billing_settings, etc.).

### 21.2 Client DBs

Each Space has its own client DB. Back is the **only** writer. Reads come from back's read endpoints + the SQL REST API.

| Tier | Engine | Access |
|---|---|---|
| Trial, Starter | D1 (schema only) | Cloudflare D1 binding per Space |
| Launch, Growth | D1 (full) | Cloudflare D1 binding per Space |
| Pro | Shared PG | Single connection pool to shared PG; schema-level isolation per Space |
| Business | Dedicated PG | Per-Space connection string |
| Enterprise | BYODB | Customer-provided connection string |

**Client DB schema** (per Space, normalized):
- `bases`, `tables`, `fields`, `views`, `records` (one table per backed-up Airtable table — created dynamically — TBD), `automations`, `interfaces`, `synced_tables`, `change_log`, `schema_snapshots`, `schema_diffs`, `audit_logs`, `health_scores`.

> **Open question:** how Airtable record data is laid out in the client DB — one wide PG table per Airtable Table (dynamic schema), or a generic `records` table with a JSONB column. Resolution affects SQL REST API ergonomics and Direct SQL UX. See §23.

---

## 22. Observability

| Layer | Tool |
|---|---|
| Workers + DOs | Cloudflare Workers Analytics + DO metrics |
| Error tracking | Cloudflare Logpush + tail Workers; evaluate Sentry post-launch if needed |
| Trigger.dev jobs | Trigger.dev dashboard — job runs, retries, errors per run |
| Database | DigitalOcean / Neon / Supabase built-in metrics |
| Uptime | Cloudflare Health Checks per critical endpoint |
| Critical errors | Engineering on-call email alerts on backup-engine, DB-provisioning, or background-service failures |
| Super-admin | Surfaces all errors in real time |

**Error rate alerts** are configured to fire before users notice — e.g., backup-failure rate > 5% over 1 hour, OAuth refresh failure rate > 10%, webhook renewal failure rate > 3%.

---

## 23. Open Questions

| # | Question | Impact | Default Answer |
|---|---|---|---|
| B1 | Client DB record layout: dynamic per-table or generic JSONB? | SQL REST API ergonomics; Direct SQL UX | Recommend **dynamic per-table** (one PG table per Airtable Table, schema-evolving) for SQL ergonomics. JSONB fallback for fields with varying shape (linked records, attachments) |
| B2 | Per-Connection DO vs. simple per-Space rate limiter | Concurrency model for shared connections | Per-Connection DO is required when one Connection serves multiple Spaces (V1 supports up to 2 connections per Space; one Connection can theoretically serve many Orgs in V2). Keep per-Connection DO. |
| B3 | Trigger.dev V3 pricing at scale | Cost projection | Validate post-staging; cap concurrent jobs per Org if needed |
| B4 | Stripe metered usage reporting — back-direct or via front? | Cross-service complexity | Recommend **back-direct** — back already has Stripe credentials for this read-only use; avoids a period-close dance with front |
| B5 | Smart cleanup for static-only customers (no dynamic DB) | Where snapshots are tracked | Static snapshots tracked in a master-DB `static_snapshots` table; cleanup deletes from R2 / customer destination + master row |
| B6 | Webhook gap-detection threshold | When to do a full re-read vs incremental | Recommend full re-read if last_known_cursor is older than 24h or if 3 consecutive webhook fetches return 0 events when records were modified |
| B7 | BYODB write-fail behavior | Customer DB outage | Recommend pause backups, fire alert, retry every 5 min for 24h, then escalate to CSM |
| B8 | Dedicated PG migration cadence | When to move a Pro customer to Dedicated tier proactively | Triggered by upgrade event only; proactive migration is V2 |
| B9 | `baseout-admin` audit log retention | Compliance / cost | Recommend 24 months; archive to R2 after |
| B10 | Email template duplication vs shared package | Maintenance cost | Recommend duplication for V1; factor into `@baseout/email-templates` package if it grows past ~10 shared templates |

---

*Version 1.0 — Back PRD created May 1, 2026. Split from BaseOut_PRD_v2.md (V1.4). See `../front/Front_PRD.md` for web app, web API endpoints, and Stripe webhook handler. See `../shared/` for cross-cutting Features, DB Schema, and Pricing/Credit specs.*
