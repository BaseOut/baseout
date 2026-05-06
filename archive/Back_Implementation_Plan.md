# Baseout Back — Implementation Plan
**Version:** 1.0
**Date:** May 1, 2026
**Status:** Draft
**Source:** `Back_PRD.md` (V1.0) + `../shared/Baseout_Features.md` + `../shared/Master_DB_Schema.md`

> **Companion plan:** `../front/Front_Implementation_Plan.md`. Phase numbers are coordinated so cross-side dependencies line up by phase number.

---

## Overview

Sequence the back build so that:
1. The backup engine works end-to-end against real Airtable data before any auxiliary capability is built on top of it.
2. The cross-service contract (Back PRD §16) is locked early so front can build against a stable interface.
3. Background services come online once the engine is stable enough to need maintenance loops.
4. The super-admin app comes last — it observes systems already in production.

---

## Repository Map

| Repo | Contents | Can start |
|---|---|---|
| `baseout-backup-engine` | Backup execution, restore execution, schema diff, webhook ingestion, SQL REST API, DB provisioning. Built on Durable Objects + Trigger.dev | Phase 0 |
| `baseout-background-services` | Cron workers — webhook renewal, OAuth refresh, dead-connection notifier, trial/quota monitors, smart cleanup, On2Air migration script | Phase 2 (after engine is stable) |
| `baseout-admin` | Super-admin Astro app | Phase 6 (after most of the system is observable) |

---

## Phase 0 — Foundation

**Goal:** Repos, CI/CD, secrets, Cloudflare projects, and `@baseout/db-schema` consumed.

| Task | Repo | Notes |
|---|---|---|
| Create `baseout-backup-engine` and `baseout-background-services` repos | both | README, Vitest, Drizzle, msw, Wrangler config |
| GitHub Actions CI | both | Vitest on every PR; Docker PG + Miniflare D1 spun up in CI |
| Cloudflare Workers projects | both | Production + staging accounts |
| Consume `@baseout/db-schema` package | both | Imported from front's published package; pinned version |
| Cloudflare Secrets | both | Master DB string, encryption key, Trigger.dev key, Cloudflare API token, Stripe key, Mailgun key, service-to-front HMAC |
| Trigger.dev account | infra | One project per environment |
| DigitalOcean shared PG cluster | infra | For Pro tier; provisioned with schema-level isolation conventions |
| Neon / Supabase accounts | infra | For Dedicated PG provisioning later |

**Cross-side dependency:** Front Phase 0 publishes `@baseout/db-schema`. Coordinate version 1.0.0 release.

---

## Phase 1 — Backup Engine MVP

**Goal:** A real Airtable account can be backed up via the engine; produces a valid CSV in R2; writes a `backup_runs` row.

### 1A — Airtable Client

| Task | Notes |
|---|---|
| OAuth token holder + refresh | Reads encrypted token from `connections`; refreshes via Airtable; writes back |
| Schema discovery | List bases, tables, fields, views via Airtable Metadata API |
| Record fetch with pagination | Handles rate limits (429), retries, cursor advancement |
| Attachment URL refresh | Re-fetch URL when within 1 hour of expiry |
| Enterprise-scope variant | Detect Enterprise + extract additional metadata |

### 1B — Per-Connection Durable Object

| Task | Notes |
|---|---|
| DO per `connections.id` | Holds OAuth token + rate-limit budget |
| API call queue | Serializes calls when multiple Spaces share a Connection |
| 5-second contention retry | Per Back PRD §10.7 |

### 1C — Per-Space Durable Object

| Task | Notes |
|---|---|
| DO per `spaces.id` | Backup state machine (idle → running → success/failed) |
| Cron-like scheduler | Reads `backup_configurations.frequency`; computes `next_scheduled_run_at` |
| WebSocket emitter | Live progress events per cross-service contract |

### 1D — Static Backup (Schema + Records → R2)

| Task | Notes |
|---|---|
| Trigger.dev job per base | One job per `(run_id, base_id)`; parallel execution |
| CSV streaming | In-memory; no disk write on Baseout (privacy) |
| File path: `/{user-root}/{Space}/{Base}/{DateTime}/{Table}.csv` | Per Back PRD §4.8 |
| R2 write | Default destination for managed plans |
| `backup_runs` lifecycle | Insert with `pending` (front) → `running` → final status |
| `backup_run_bases` per-base detail | Per-entity verification baseline |

### 1E — Attachment Handling

| Task | Notes |
|---|---|
| Composite ID dedup | `{base}_{table}_{record}_{field}_{attachment}` |
| Stream to R2 | Default; attach refresh on URL expiry |
| Retry on failure | 3 retries with backoff |

### 1F — Trial Cap Enforcement

| Task | Notes |
|---|---|
| 1,000 records / 5 tables / 100 attachments | Hard stop at first cap hit |
| Mark `trial_complete` | Update `subscription_items.trial_backup_run_used = true` |
| Trigger Trial Cap Hit email | Back-owned (§14 of Back PRD) |

### 1G — Run Trigger Endpoint

| Task | Notes |
|---|---|
| `POST /runs/{run_id}/start` | Service-token auth from front |
| Validates `backup_runs.status='pending'` | Idempotent |
| Enqueues Trigger.dev job | Returns 200 immediately |

**Cross-side checkpoint:** front's onboarding wizard Phase 2 calls this endpoint. Lock contract before front starts Phase 2.

---

## Phase 2 — Restore Engine + Storage Destinations + Background Services Foundation

**Goal:** Restore works end-to-end. All V1 storage destinations functional. Background services come online.

### 2A — Restore Engine

| Task | Notes |
|---|---|
| `POST /restores/{id}/start` endpoint | Service-token auth |
| Snapshot validation | Within retention window |
| Connection lock acquisition | Per-Connection DO |
| New base creation via Airtable API | Workspace ID input from front |
| Existing base + new table | Starter+ |
| Write order: tables → records → linked records → attachments | Per Back PRD §5.3 |
| Attachment re-upload | Stream from R2/source destination to Airtable |
| Post-restore verification (Growth+) | Record count match; audit log |
| Restore Complete email | Back-owned |
| Restore credit accounting | `organization_restore_usage` + `credit_transactions` |

### 2B — Storage Destinations (Server-Side)

| Task | Notes |
|---|---|
| `StorageWriter` interface | Common API across destinations |
| R2 implementation | Default; encrypted at rest |
| Google Drive | OAuth-based file write |
| Dropbox | Proxy stream (no disk) |
| Box | Proxy stream |
| OneDrive | OAuth-based file write |
| S3 | IAM access; Growth+ |
| Frame.io | OAuth; Growth+ |

> Front Phase 2 owns the OAuth/IAM auth flows; back owns the write logic. The configuration row in `storage_destinations` is the handoff.

### 2C — Background Services Bootstrapping

| Task | Notes |
|---|---|
| Wrangler cron-trigger config | One cron per service per environment |
| Webhook renewal service | Daily; renew at 6-day threshold |
| OAuth token refresh service | Every 15 min; refresh before expiry |
| Connection lock manager | DO-based; 5-second retry |

### 2D — Live Progress (WebSocket)

| Task | Notes |
|---|---|
| WebSocket endpoint on per-Space DO | `wss://{BACKUP_ENGINE_URL}/spaces/{id}/progress` |
| Auth | Session cookie or short-lived token from front |
| Event emission per Back PRD §16.3 | `run_started`, `base_started`, `progress_pct`, `base_completed`, `run_completed`, `error` |

**Cross-side checkpoint:** front Phase 3 connects to this endpoint. Lock event schema before front starts Phase 3.

---

## Phase 3 — Dynamic Backup + Schema Diff + Health Score

**Goal:** Dynamic backup writes to client DB; schema diff and health score are computed per run.

### 3A — Database Provisioning

| Task | Notes |
|---|---|
| D1 provisioning | Cloudflare API; record `space_databases.d1_database_id` |
| Shared PG provisioning | Create schema (`org_{orgId}`) on shared instance |
| Dedicated PG provisioning | Neon / Supabase / DigitalOcean per-Space DB |
| BYODB validation | Connectivity check; schema-create required tables |
| `space_databases.provisioning_status` lifecycle | `pending → provisioning → active → migrating → error` |

### 3B — Dynamic Backup (Schema Only — Trial, Starter)

| Task | Notes |
|---|---|
| D1 binding per Space | Bound at runtime via Workers binding lookup |
| Schema metadata write | Tables, fields, views, relationships |
| No record data | Schema-only mode |

### 3C — Dynamic Backup (Full — Launch+)

| Task | Notes |
|---|---|
| Per-table client DB schema | Dynamic per-table (one PG table per Airtable Table) — see Back PRD §21.2 |
| Record write | Streamed insert; conflict resolution on incremental runs |
| Attachment metadata | Linked from R2 path |
| Change log table | For incremental tracking |

### 3D — Database Tier Migration

| Task | Notes |
|---|---|
| Migration trigger on tier upgrade | Detected on Stripe webhook → back invoked |
| Block backups during migration | `backup_configurations.is_active=false` |
| Stream data: schema → records → change log | Verify counts and constraints |
| Switch `space_databases` to new tier | Atomic |
| Decommission old DB | After 7-day grace period |

### 3E — Schema Diff & Changelog

| Task | Notes |
|---|---|
| Diff engine | Compare current schema vs. previous run |
| Persist to client DB | `schema_diffs` table |
| Human-readable rendering | Read endpoint that returns natural-language strings |
| Schema change notification | Email + in-app on material changes |

### 3F — Health Score

| Task | Notes |
|---|---|
| Rule engine | Read `health_score_rules`; evaluate each |
| Score calculation | Weighted 0–100 |
| Band assignment | Green 90+, Yellow 60–89, Red <60 |
| Persist per Base | `health_scores` table in client DB |
| Health Score Change notification | When band shifts |

### 3G — Read Endpoints for Front

| Task | Notes |
|---|---|
| `GET /spaces/{id}/schema` | Latest metadata |
| `GET /spaces/{id}/schema/changelog` | Diff entries |
| `GET /spaces/{id}/restore-bundle/{run_id}` | Community Restore Tooling |

---

## Phase 4 — Webhook Ingestion + Inbound Forwarding + Dead-Connection Cadence + On2Air Migration

**Goal:** Instant Backup works (Pro+); Inbound API end-to-end; dead-connection cadence functional; On2Air migration script ready.

### 4A — Airtable Webhook Ingestion

| Task | Notes |
|---|---|
| `POST /webhooks/airtable/{webhook_id}` | Public endpoint; HMAC verification |
| Look up `airtable_webhooks` row | Forward event to per-Space DO |
| DO event queue + coalescing | Persist batches to `change_log` |
| Incremental run trigger | Configurable threshold (event count or time) |
| Webhook registration on Instant Backup enable | Pro+ |

### 4B — Inbound API Forwarding (Back side)

| Task | Notes |
|---|---|
| `POST /inbound/automations` | Service-token auth from front; writes to client DB |
| `POST /inbound/interfaces` | Same |
| `POST /inbound/synced-tables` | Same |
| `POST /inbound/custom-metadata` | Same |
| Versioning per entity ID | Track update history |

### 4C — Dead-Connection Notification Cadence

| Task | Notes |
|---|---|
| Detect `connections.status='pending_reauth'` | Trigger when OAuth refresh fails |
| Send 1 (immediate), Send 2 (+2d), Send 3 (+3d), Send 4 (+5d, final) | Per Back PRD §10.3 |
| Track in `notification_log` | sent_count, last_sent_at, next_send_at |
| Mark `is_resolved=true` on user re-auth | Cadence stops |
| After Send 4: `connections.status='invalid'` | invalidated_at set |

### 4D — Trial Expiry Monitor

| Task | Notes |
|---|---|
| Hourly cron | Scan `subscription_items` |
| Day 5: Trial Expiry Warning email | Back-owned |
| Day 7: Trial Expired; Stripe convert or expire | Back-owned email |

### 4E — Quota Usage Monitor

| Task | Notes |
|---|---|
| Hourly cron | Per-Org credit + storage usage compute |
| 75/90/100% thresholds | One-shot per period (tracked in `notification_log`) |
| Overage alert | When `is_overage=true` transactions appear |

### 4F — Smart Cleanup Scheduler

| Task | Notes |
|---|---|
| Schedule per tier | Monthly/Weekly/Daily/Continuous |
| Per-Space policy evaluation | Basic / Time-based / Two-tier / Three-tier / Custom |
| Delete snapshots beyond retention | R2 + master DB row |
| `cleanup_runs` row | trigger_type='scheduled', credits_used=0 |

### 4G — On2Air Migration Script

| Task | Notes |
|---|---|
| Read legacy On2Air DB | One-shot |
| Map to Baseout tiers | Per `../shared/Pricing_Credit_System.md` §5 |
| Create Baseout Orgs + Stripe customers + subscriptions | dynamic_locked=true, has_migrated=false |
| Decrypt + re-encrypt backup metadata | Legacy keys → AES-256-GCM |
| Grant migration credits | Per `../shared/Pricing_Credit_System.md` §6 |
| Sanity checks + manual review queue | Dry-run mode supported |
| Idempotent re-run | Safe to retry on failure |

**Cross-side checkpoint:** front Phase 7 ("Complete Your Migration" UX) consumes the state populated by this script.

---

## Phase 5 — SQL REST API + Direct SQL + Credit Consumption Hardening

**Goal:** Pro+ programmatic access; full credit accounting in production.

### 5A — SQL REST API

| Task | Notes |
|---|---|
| Custom Cloudflare Worker | Deployed to `sql.baseout.com` |
| Bearer token auth | `api_tokens` (per-Space) |
| Read-only query enforcement | Read-only DB role + query parsing |
| Parameterized queries only | Reject raw concatenated SQL |
| Rate limiting | Tier-based |
| Credit consumption | 1 credit per 50 queries |
| Response size cap | 10 MB default; pagination |
| OpenAPI spec | Hosted at `docs.baseout.com` |

### 5B — Direct SQL Access (Business+)

| Task | Notes |
|---|---|
| Read-only role provisioning | On DB provisioning |
| Connection string display endpoint | Decrypted on-demand for front; never logged |
| Periodic credential rotation | 90-day default; 7-day overlap |

### 5C — Credit Consumption Hardening

| Task | Notes |
|---|---|
| Bucket priority order | onboarding → plan_monthly → addon_monthly → promotional → purchased → manual_grant |
| Mid-run overage cap pause | Long-running backups can pause if cap hit; resume on cap raise |
| `organization_credit_balance` cache | Rebuilt on each transaction |
| Stripe metered usage reporting | End-of-period cron in back |

---

## Phase 6 — Super-Admin App (`baseout-admin`)

**Goal:** Internal tooling functional before public launch.

### 6A — `baseout-admin` Scaffold

| Task | Notes |
|---|---|
| Astro SSR project | Separate Cloudflare Pages project |
| Consume `baseout-ui` | Reuse component library |
| Consume `@baseout/db-schema` | Same package as web/backup-engine |
| Google SSO auth | Baseout-staff-only |
| Audit log table | Immutable record of admin actions |

### 6B — Capability Surfaces

| Task | Notes |
|---|---|
| Organization browser | All Orgs; search/filter; per-Org drill-in |
| Subscription dashboard | All subs; MRR view |
| Backup run viewer | Cross-Org filter |
| DB provisioning tracker | All client DBs; utilization; health |
| Connection health dashboard | OAuth status; webhook renewal state |
| Background-service monitor | Last run + status per service |
| On2Air migration status | Migrated vs. pending counts |
| Manual admin actions | Force backup; invalidate connection; reset trial; adjust plan; grant credits; force migration completion |
| Error log search | Logpush destination query |

---

## Phase 7 — Email Templates + Pre-Launch Hardening

### 7A — React Email Templates (Back-Owned)

Per Back PRD §14:

- Backup Audit Report
- Monthly Backup Summary
- Backup Failure / Warning Alert
- Trial Cap Hit
- Trial Expiry Warning / Trial Expired
- Dead Connection Warning ×4
- Quota Warning (75/90/100%)
- Overage Started / Overage Cap Reached
- Schema Change Notification
- Health Score Change
- Restore Complete
- Webhook Renewal Failure

Each: React Email component → renders to HTML/text → sent via Mailgun SDK (back's API key).

### 7B — Observability

| Task | Notes |
|---|---|
| Logpush destination | R2 or external for error log archive |
| Tail Workers | Real-time error streaming |
| Health Checks | Per critical endpoint |
| On-call alert routing | Backup-engine, DB-provisioning, background-service failure → email/PagerDuty |
| Error rate alerts | Backup failure > 5%/h, OAuth refresh failure > 10%/h, webhook renewal failure > 3%/h |

### 7C — Load / Stress Testing

| Task | Notes |
|---|---|
| Concurrent backup runs | Validate DO + lock behavior under contention |
| Trigger.dev concurrency | Validate cost projection at scale |
| Per-Connection DO throughput | Confirm no thundering-herd issues |
| BYODB write fail handling | Per Back PRD §23 B7 |

### 7D — Security Review

| Task | Notes |
|---|---|
| Secrets audit | All in Cloudflare Secrets; no hardcoded values |
| Encryption validation | OAuth tokens, connection strings, API token hashing |
| Service token rotation drill | Confirm rotation does not break in-flight runs |
| `baseout-admin` audit trail | Confirm every admin action logged |

---

## Cross-Side Dependencies Summary

| Back Phase | Depends on Front Phase | Reason |
|---|---|---|
| 0 | 0 | `@baseout/db-schema` published from front |
| 1 (Run trigger endpoint) | 2 (Onboarding wizard) | Front calls back's `/runs/{id}/start` |
| 2 (WebSocket) | 3 (Live progress UI) | Front consumes the DO endpoint |
| 2 (Storage destinations) | 2 (OAuth flows) | Front initiates OAuth; back uses tokens |
| 3 (Read endpoints) | 4 (Schema/Data UIs) | Front reads from back |
| 4 (Inbound forwarding) | 5 (Inbound API) | Front forwards to back |
| 4 (On2Air migration script) | 7 (Migration UX) | Script populates state front consumes |
| 5 (Credit consumption) | 5 (Stripe metered usage) | Coordinated period-close — back reports directly to Stripe |

---

## Definition of Done — Back V1 Launch

- [ ] Backup engine: scheduled, manual, and webhook-triggered runs all functional
- [ ] Static backup writes to R2 + all 6 BYOS destinations
- [ ] Dynamic backup writes to D1 (schema + full), Shared PG, Dedicated PG, BYODB
- [ ] Trial cap enforcement at run level
- [ ] DO topology stable (per-Connection + per-Space)
- [ ] Trigger.dev jobs scale with concurrency targets
- [ ] Restore engine: base-level, table-level, point-in-time, new base, existing-base-new-table
- [ ] Post-restore verification (Growth+)
- [ ] Schema diff + changelog computed on every run
- [ ] Health score computed and persisted per Base
- [ ] Airtable webhook ingestion + cursor advancement + gap fallback
- [ ] All 7 background services running on cron
- [ ] Dead-connection 4-touch cadence functional
- [ ] On2Air migration script run successfully against staging fixtures
- [ ] SQL REST API: auth, rate limit, read-only enforcement, credit consumption
- [ ] Direct SQL Access: read-only role + connection string surface (Business+)
- [ ] All back-owned React Email templates send via Mailgun
- [ ] `baseout-admin` deployed; all capability surfaces functional
- [ ] Observability: Logpush, tail Workers, health checks, on-call routing
- [ ] Load test passes; concurrent runs do not deadlock
- [ ] Security review complete; secrets rotation drill passed
- [ ] Trigger.dev cost projection validated

---

*Version 1.0 — Back Implementation Plan created May 1, 2026. Split from Baseout_Implementation_Plan.md (V1.0). Coordinate phase progress with `../front/Front_Implementation_Plan.md`.*
