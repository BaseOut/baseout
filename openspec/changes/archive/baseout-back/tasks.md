## 1. Phase 0 — Foundation

- [ ] 1.1 Create `baseout-server` repo with README, Vitest, Drizzle, msw, Wrangler config, Astro Cloudflare adapter, and a directory layout that separates `src/handlers/` (HTTP routes), `src/cron/` (cron handlers), `src/durable-objects/`, `src/trigger-dev/`, `src/admin/` (Astro SSR pages for super-admin), `src/emails/`, `src/lib/` (shared utilities)
- [ ] 1.2 Wire GitHub Actions CI on `baseout-server` (Vitest on every PR; Docker PG + Miniflare D1 in CI)
- [ ] 1.3 Provision one Cloudflare Workers project per environment (production + staging) with a single `wrangler.toml` declaring route bindings (one per public hostname including `admin.baseout.com`), cron triggers, DO bindings, and R2/D1 bindings
- [ ] 1.4 Consume `@baseout/db-schema` from front (pinned version)
- [ ] 1.5 Populate Cloudflare Secrets (master DB string, encryption key, Trigger.dev key, Cloudflare API token, Stripe key, Mailgun key, service-to-front HMAC, Google SSO client secret) for both environments
- [ ] 1.6 Set up Trigger.dev account with one project per environment
- [ ] 1.7 Provision DigitalOcean shared PG cluster with schema-level isolation conventions
- [ ] 1.8 Set up Neon / Supabase accounts for Dedicated PG provisioning

## 2. Phase 1 — Backup Engine MVP

- [ ] 2.1 Implement Airtable client: OAuth token holder + refresh path
- [ ] 2.2 Implement Airtable schema discovery (list bases, tables, fields, views via Metadata API)
- [ ] 2.3 Implement Airtable record fetch with pagination, 429 handling, retry, cursor advancement
- [ ] 2.4 Implement attachment URL refresh (re-fetch when within 1h of expiry)
- [ ] 2.5 Implement Airtable Enterprise-scope variant
- [ ] 2.6 Implement per-Connection Durable Object (token holder, rate-limit budget, API call queue, 5s contention retry)
- [ ] 2.7 Implement per-Space Durable Object (state machine, cron-like scheduler, WebSocket emitter)
- [ ] 2.8 Implement Trigger.dev job per base for static backup
- [ ] 2.9 Implement in-memory CSV streaming (no Baseout-disk writes for static)
- [ ] 2.10 Implement file path layout `/{user-root}/{Space}/{Base}/{DateTime}/{Table}.csv`
- [ ] 2.11 Implement R2 write as default destination
- [ ] 2.12 Implement `backup_runs` lifecycle (insert by front → running → final status)
- [ ] 2.13 Implement `backup_run_bases` per-base verification rows
- [ ] 2.14 Implement attachment composite-ID dedup `{base}_{table}_{record}_{field}_{attachment}`
- [ ] 2.15 Implement attachment R2 stream with retry on failure
- [ ] 2.16 Implement trial cap enforcement (1K records / 5 tables / 100 attachments) → mark `trial_complete`, set `trial_backup_run_used=true`, fire Trial Cap Hit email
- [ ] 2.17 Implement `POST /runs/{run_id}/start` endpoint (service-token auth, idempotent, enqueue Trigger.dev job, return 200)
- [ ] 2.18 Lock the run-trigger contract with front before they start their Phase 2

## 3. Phase 2 — Restore Engine + Storage Destinations + Background Services Foundation

- [ ] 3.1 Implement `POST /restores/{id}/start` endpoint (service-token auth, snapshot-validation, connection-lock acquire)
- [ ] 3.2 Implement Airtable new-base creation via API for restore destination
- [ ] 3.3 Implement existing-base + new-table restore (Starter+)
- [ ] 3.4 Implement restore write order: tables → records → linked records → attachments
- [ ] 3.5 Implement attachment re-upload from R2/source destination to Airtable
- [ ] 3.6 Implement post-restore verification (record count match, audit log) for Growth+
- [ ] 3.7 Implement Restore Complete email (back-owned)
- [ ] 3.8 Implement restore credit accounting (`organization_restore_usage` + `credit_transactions`)
- [ ] 3.9 Implement Community Restore Tooling AI-prompt-bundle generation (Pro+) and `GET /spaces/{id}/restore-bundle/{run_id}` endpoint
- [ ] 3.10 Define common `StorageWriter` interface (`init`, `writeFile`, `getDownloadUrl`, `delete`)
- [ ] 3.11 Implement R2 strategy
- [ ] 3.12 Implement Google Drive strategy (OAuth)
- [ ] 3.13 Implement Dropbox strategy (OAuth + proxy stream)
- [ ] 3.14 Implement Box strategy (OAuth + proxy stream)
- [ ] 3.15 Implement OneDrive strategy (OAuth)
- [ ] 3.16 Implement S3 strategy (IAM access, Growth+)
- [ ] 3.17 Implement Frame.io strategy (OAuth, Growth+)
- [ ] 3.18 Add cron-trigger entries in `baseout-server`'s `wrangler.toml` (one per service per environment) and route each schedule to the corresponding handler in `src/cron/`
- [ ] 3.19 Implement webhook renewal background service (daily; renew at 6-day threshold; 3-strike disable + alert)
- [ ] 3.20 Implement OAuth token refresh background service (every 15 min; refresh before expiry; on failure → `pending_reauth` + start dead-connection cadence)
- [ ] 3.21 Implement connection lock manager (DO-based; 5s retry budget)
- [ ] 3.22 Implement WebSocket endpoint on per-Space DO at `wss://{BACKUP_ENGINE_URL}/spaces/{space_id}/progress`
- [ ] 3.23 Emit live-progress events per cross-service contract (`run_started`, `base_started`, `progress_pct`, `base_completed`, `run_completed`, `error`)
- [ ] 3.24 Lock WebSocket event schema with front before they start their Phase 3

## 4. Phase 3 — Dynamic Backup + Schema Diff + Health Score

- [ ] 4.1 Implement D1 provisioning via Cloudflare API; record `space_databases.d1_database_id`
- [ ] 4.2 Implement Shared PG provisioning (create `org_{orgId}` schema)
- [ ] 4.3 Implement Dedicated PG provisioning (Neon / Supabase / DigitalOcean per-Space DB)
- [ ] 4.4 Implement BYODB validation (connectivity check; schema-create required tables)
- [ ] 4.5 Implement `space_databases.provisioning_status` lifecycle (`pending → provisioning → active → migrating → error`)
- [ ] 4.6 Implement Dynamic Schema-Only mode (D1, Trial + Starter)
- [ ] 4.7 Implement Dynamic Full mode (Launch+) with per-table client DB schema (one PG table per Airtable Table)
- [ ] 4.8 Implement record streaming insert with conflict resolution for incremental runs
- [ ] 4.9 Implement attachment metadata link to R2 path
- [ ] 4.10 Implement client-DB change-log table for incremental tracking
- [ ] 4.11 Implement DB tier migration trigger on Stripe upgrade webhook
- [ ] 4.12 Implement migration flow (block backups → provision new → stream schema/records/change log → verify → atomic switch → 7-day grace decommission)
- [ ] 4.13 Implement migration rollback path (keep old DB active on failure; alert engineering on-call)
- [ ] 4.14 Implement schema diff engine (added/removed/renamed/type/view changes)
- [ ] 4.15 Persist diffs to client DB `schema_diffs` table
- [ ] 4.16 Implement `GET /spaces/{id}/schema/changelog?since=...` with human-readable string rendering
- [ ] 4.17 Implement Schema Change Notification email + in-app on material diffs
- [ ] 4.18 Implement health-score rule engine (read `health_score_rules`, evaluate, weighted 0–100)
- [ ] 4.19 Persist health score per Base in client-DB `health_scores` table; assign band (Green ≥90, Yellow 60–89, Red <60)
- [ ] 4.20 Implement Health Score Change email + in-app when band shifts
- [ ] 4.21 Implement `GET /spaces/{id}/schema` read endpoint

## 5. Phase 4 — Webhook Ingestion + Inbound Forwarding + Dead-Connection Cadence + Trial / Quota / Cleanup + On2Air

- [ ] 5.1 Implement `POST /webhooks/airtable/{webhook_id}` public endpoint with HMAC verification
- [ ] 5.2 Implement per-Space DO event queue + coalescing → persist batches to `change_log`
- [ ] 5.3 Implement incremental run trigger (configurable event-count or time threshold)
- [ ] 5.4 Implement webhook registration on Instant Backup enable (Pro+)
- [ ] 5.5 Implement cursor advancement on `airtable_webhooks.cursor`
- [ ] 5.6 Implement gap-detection fallback (24h OR 3 zero-event fetches with modified records → full re-read)
- [ ] 5.7 Implement `POST /inbound/automations` ingestion endpoint
- [ ] 5.8 Implement `POST /inbound/interfaces` ingestion endpoint
- [ ] 5.9 Implement `POST /inbound/synced-tables` ingestion endpoint
- [ ] 5.10 Implement `POST /inbound/custom-metadata` ingestion endpoint
- [ ] 5.11 Implement entity-versioning per ID for inbound writes
- [ ] 5.12 Implement dead-connection 4-touch cadence (Send 1 immediate, Send 2 +2d, Send 3 +3d, Send 4 +5d) with `notification_log` tracking
- [ ] 5.13 Stop cadence early on user re-auth; mark `is_resolved=true`, `resolved_at`
- [ ] 5.14 After Send 4: set `connections.status='invalid'` + `invalidated_at`
- [ ] 5.15 Implement trial expiry monitor (hourly cron; Day-5 warning; Day-7 convert or expire)
- [ ] 5.16 Implement quota usage monitor (hourly cron; 75/90/100 one-shot per period; overage notification on `is_overage=true` first-appearance)
- [ ] 5.17 Implement smart-cleanup scheduler (per-tier cadence; Basic / Time-based / Two-tier / Three-tier / Custom; deletes snapshots beyond retention; writes `cleanup_runs`)
- [ ] 5.18 Implement On2Air migration script (one-shot Worker; legacy DB read; tier mapping per `../shared/Pricing_Credit_System.md` §5; create Org + Stripe customer + subscription + items; `dynamic_locked=true`, `has_migrated=false`; re-encrypt under AES-256-GCM; grant migration credits per §6; dry-run mode; idempotent re-run; manual review queue)

## 6. Phase 5 — SQL REST API + Direct SQL + Credit Consumption Hardening

- [ ] 6.1 Provision `sql.baseout.com` Cloudflare Worker
- [ ] 6.2 Implement bearer-token auth via `api_tokens` (per-Space scope)
- [ ] 6.3 Implement read-only enforcement (read-only DB role + query parsing for INSERT/UPDATE/DELETE/DDL rejection)
- [ ] 6.4 Implement parameterization requirement (reject raw concatenated literals)
- [ ] 6.5 Implement tier-based monthly rate limits (10K Pro, 50K Business, Unlimited Enterprise)
- [ ] 6.6 Implement credit consumption (1 credit per 50 queries → `credit_transactions`)
- [ ] 6.7 Implement 10 MB response size cap with cursor-based pagination
- [ ] 6.8 Author OpenAPI 3 spec; host at `docs.baseout.com`
- [ ] 6.9 Implement read-only PG role provisioning on Business+ DB provisioning
- [ ] 6.10 Implement Direct SQL connection-string read endpoint (decrypt on-demand; never log plaintext)
- [ ] 6.11 Implement periodic credential rotation (90-day default; 7-day overlap; revoke old after overlap)
- [ ] 6.12 Implement bucket priority order (onboarding → plan_monthly → addon_monthly → promotional → purchased → manual_grant)
- [ ] 6.13 Implement mid-run overage cap pause behavior (`backup_runs.status='paused'`; resume on cap raise / credit purchase / upgrade)
- [ ] 6.14 Implement pre-run cap refusal (when `overage_mode='cap'` + buckets exhausted)
- [ ] 6.15 Implement `organization_credit_balance` cache update on every transaction
- [ ] 6.16 Implement Stripe metered usage reporting cron (back-direct, period-close)

## 7. Phase 6 — Super-Admin Surface (within `baseout-server`)

- [ ] 7.1 Scaffold Astro SSR pages under `baseout-server/src/admin/` using the Astro Cloudflare adapter; bind `admin.baseout.com` as a route in `wrangler.toml`
- [ ] 7.2 Consume `baseout-ui` (component library)
- [ ] 7.3 Consume `@baseout/db-schema`
- [ ] 7.4 Implement Google Workspace SSO auth as a hostname-scoped middleware that runs only on `admin.baseout.com` requests; assert via integration test that customer-facing hostnames never reach admin handlers
- [ ] 7.5 Implement immutable audit log table (no UPDATE/DELETE permissions for app role)
- [ ] 7.6 Build Organization browser (search/filter/per-Org drill-in)
- [ ] 7.7 Build Subscription dashboard (all subs, MRR view)
- [ ] 7.8 Build Backup run viewer (cross-Org filter, status/time-window filter)
- [ ] 7.9 Build DB provisioning tracker (all client DBs, utilization, health)
- [ ] 7.10 Build Connection health dashboard (OAuth status, webhook renewal state)
- [ ] 7.11 Build background-service monitor (last run + status per service)
- [ ] 7.12 Build On2Air migration status (migrated vs pending counts)
- [ ] 7.13 Build manual admin actions (force backup, invalidate connection, reset trial, adjust plan, grant credits, force migration completion) — each writes audit row before executing
- [ ] 7.14 Build error log search (Logpush destination query)

## 8. Phase 7 — Email Templates + Pre-Launch Hardening

- [ ] 8.1 Build React Email templates: Backup Audit Report, Monthly Backup Summary, Backup Failure Alert, Backup Warning Alert, Trial Cap Hit, Trial Expiry Warning, Trial Expired, Dead Connection Warning ×4, Quota Warning (75/90/100%), Overage Started, Overage Cap Reached, Schema Change Notification, Health Score Change, Restore Complete, Webhook Renewal Failure
- [ ] 8.2 Wire Mailgun SDK with back-scoped API key + sending domain `mail.baseout.com`
- [ ] 8.3 Configure Logpush destination (R2 or external) for error log archive
- [ ] 8.4 Wire tail Workers for real-time error streaming
- [ ] 8.5 Configure Health Checks per critical endpoint
- [ ] 8.6 Wire on-call alert routing (backup-engine, DB-provisioning, background-service failure → email/PagerDuty)
- [ ] 8.7 Configure error-rate alerts (backup failure >5%/h, OAuth refresh failure >10%/h, webhook renewal failure >3%/h)
- [ ] 8.8 Run concurrent-backup-runs load test (validate DO + lock behavior under contention)
- [ ] 8.9 Run Trigger.dev concurrency cost test (validate projection at scale)
- [ ] 8.10 Run per-Connection DO throughput test (confirm no thundering-herd)
- [ ] 8.11 Run BYODB write-fail handling test (per Back PRD §23 B7)
- [ ] 8.12 Audit secrets — confirm all in Cloudflare Secrets, no hardcoded values
- [ ] 8.13 Validate encryption (OAuth tokens, connection strings, API token hashing)
- [ ] 8.14 Run service-token rotation drill (confirm no in-flight run breakage)
- [ ] 8.15 Confirm super-admin audit trail captures every admin action and that no audit row can be UPDATEd or DELETEd via the app role

## 9. Definition of Done — Back V1 Launch

- [ ] 9.1 Backup engine: scheduled, manual, and webhook-triggered runs functional
- [ ] 9.2 Static backup writes to R2 + all 6 BYOS destinations
- [ ] 9.3 Dynamic backup writes to D1 (schema + full), Shared PG, Dedicated PG, BYODB
- [ ] 9.4 Trial cap enforced at run level
- [ ] 9.5 DO topology stable (per-Connection + per-Space)
- [ ] 9.6 Trigger.dev jobs scale to concurrency targets
- [ ] 9.7 Restore engine: base / table / point-in-time / new base / existing-base-new-table all functional
- [ ] 9.8 Post-restore verification (Growth+) functional
- [ ] 9.9 Schema diff + changelog computed on every run
- [ ] 9.10 Health score computed and persisted per Base
- [ ] 9.11 Airtable webhook ingestion + cursor advancement + gap fallback functional
- [ ] 9.12 All 7 background services running on cron
- [ ] 9.13 Dead-connection 4-touch cadence functional
- [ ] 9.14 On2Air migration script run successfully against staging fixtures
- [ ] 9.15 SQL REST API: auth, rate limit, read-only enforcement, credit consumption all functional
- [ ] 9.16 Direct SQL Access: read-only role + connection string surface (Business+) functional
- [ ] 9.17 All back-owned React Email templates send via Mailgun
- [ ] 9.18 Super-admin surface deployed within `baseout-server` on `admin.baseout.com`; all capability surfaces functional and isolated from customer-hostname requests
- [ ] 9.19 Observability: Logpush, tail Workers, health checks, on-call routing wired
- [ ] 9.20 Load test passes; concurrent runs do not deadlock
- [ ] 9.21 Security review complete; secrets rotation drill passed
- [ ] 9.22 Trigger.dev cost projection validated
