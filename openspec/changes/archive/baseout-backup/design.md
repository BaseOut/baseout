## Context

`baseout-backup` is the data plane: long-running workflows, Durable Objects, cron handlers, Trigger.dev jobs, client DB writes, and the operational email categories that fire from any of the above. It's deployed as one Cloudflare Workers project at `apps/backup/`, independent of `baseout-web`, `baseout-inbound-api`, `baseout-sql-rest-api`, `baseout-webhook-ingestion`, and `baseout-admin`. It does NOT serve a public Airtable webhook endpoint (that's `baseout-webhook-ingestion`), a public token-authed Inbound API (that's `baseout-inbound-api`), a public SQL endpoint (that's `baseout-sql-rest-api`), or any customer-facing UI (that's `baseout-web` + `baseout-admin`).

Stakeholders: engineering (the `baseout-backup` team owning the data plane), operations (super-admin users in `baseout-admin` consuming `baseout-backup`'s state + on-call), `baseout-web` team (consumers of run-trigger contracts + WebSocket progress + read endpoints), `baseout-webhook-ingestion` team (forwarders of verified Airtable events), `baseout-inbound-api` team (forwarders of validated Inbound payloads), customers (especially Pro+ for Instant Backup; Business+ for Direct SQL).

Constraints carried in from product:
- **Privacy differentiator**: static-on-BYOS runs MUST stream through memory only — no record data on Baseout disk.
- **Schema package owned by `packages/db-schema/`** — `baseout-backup` imports `@baseout/db-schema` and never redefines tables.
- **Email ownership lives with the side that detects the trigger** — `baseout-backup` calls Mailgun directly with its own key.
- **Trigger.dev for backup workflows** (not Workers cron) — needed for unlimited concurrency and no per-run time limits.
- **Per-Connection rate-limit gateway** — multiple Spaces can share an Airtable Connection; serialized at the Connection level.
- **The public Airtable webhook receiver is in `baseout-webhook-ingestion`** — `baseout-backup` exposes only an internal forward target via service binding.

## Goals / Non-Goals

**Goals:**
- A single Trigger.dev workflow per base can run unbounded with no per-run time limit and parallel across bases.
- Per-Connection DO holds the OAuth token and rate-limit budget so simultaneous Spaces sharing a Connection cannot collide on Airtable's per-account rate limits.
- Live progress emits structured events on a stable WebSocket path that `baseout-web` depends on across the run lifecycle.
- Client-DB tier migrations are reversible mid-flight and decommission the old DB only after a 7-day grace period.
- Webhook coalescing is durable across short outages via cursor-tracking and falls back to full re-read on long gaps.
- Background services are individually idempotent; double-invocation never sends duplicate notifications.
- The credit ledger pauses long-running backups mid-run when an overage cap is reached, rather than letting them blow past the cap.
- `baseout-backup` deploys independently — backup engine bug fixes don't require redeploying any other repo, and conversely.

**Non-Goals:**
- Public Airtable webhook receiver (that's `baseout-webhook-ingestion`).
- Public Inbound API endpoint (`baseout-inbound-api`).
- Public SQL REST API endpoint (`baseout-sql-rest-api`).
- Customer-facing UI (`baseout-web`).
- Admin UI (`baseout-admin`).
- Record-level restore (deferred to V1.1+).
- Cross-base restore.
- AI Insights (V2).
- MCP / RAG / chatbot / vector DB (V2).
- Automated proactive Pro → Dedicated PG migration (only triggered on upgrade event in V1).
- Built-in customer-DB backup management for BYODB (customer owns it).

## Decisions

### Cloudflare Durable Objects + Trigger.dev V3 (vs. only Workers cron)
We split orchestration across DOs (state, rate-limit gateway, live progress) and Trigger.dev V3 (per-base workflow execution). Trigger.dev gives unlimited concurrency and no time limits per job, which Workers cron cannot match for multi-hour backups of large bases. DOs give the per-Connection serialization that pure Trigger.dev workers lack. Trade: Trigger.dev pricing must be validated post-staging (B3); cap concurrent jobs per Org if needed.

### Per-Connection DO required (vs. simple per-Space rate limiter)
Per-Connection DO is mandatory because one Airtable Connection can serve multiple Spaces (V1: up to 2 connections per Space; V2: one Connection may serve many Orgs). A per-Space limiter would let two Spaces sharing a Connection blow Airtable's per-account quota. Resolved (B2).

### Webhook receiver split into its own repo
The public `POST /webhooks/airtable/{webhook_id}` endpoint lives in `baseout-webhook-ingestion`, NOT here. `baseout-backup` only owns the per-Space DO that *consumes* verified forwards. Reason: independent versioning of the public Airtable contract (signature scheme rotations, hostname/route changes) without redeploying the data plane; conversely backup-engine deploys do not interrupt webhook reception. Trade: an extra service-binding hop per event; mitigated by Cloudflare's intra-account binding latency being sub-millisecond.

### Inbound API receiver split into its own repo
Same pattern: `baseout-inbound-api` owns the public token-authed `/api/v1/inbound/*` endpoint and forwards validated payloads to `baseout-backup`'s internal `/inbound/{type}` endpoints. `baseout-backup` writes to client DBs.

### Stripe metered usage reporting from `baseout-backup`, not via `baseout-web`
`baseout-backup` already holds Stripe credentials for read-only use (subscription state) and is the side that produces the overage transactions. Reporting metered usage from `baseout-backup` avoids a period-close coordination dance with `baseout-web`. Resolved (B4).

### Client DB record layout: dynamic per-table (vs. generic JSONB)
One PG table per Airtable Table (schema-evolving) for native SQL ergonomics, with JSONB fallback for fields with varying shape (linked records, attachments). This matters most for SQL REST API ergonomics and Direct SQL UX. Resolved (B1).

### Webhook gap-detection threshold: 24h or 3 zero-event fetches with modified records
Full re-read fallback fires when `last_known_cursor` is older than 24h OR three consecutive webhook fetches return zero events while records were modified. Resolved (B6).

### Email templates: single set in this repo
All `baseout-backup`-owned React Email templates live in one place — `baseout-backup/src/emails/` — and are imported by whichever handler (HTTP, cron, Trigger.dev workflow callback) detects the trigger. No duplication across repos.

### Smart cleanup for static-only customers
Static snapshots tracked in a master-DB `static_snapshots` table; cleanup deletes from R2 / customer destination + master row. Resolved (B5).

### BYODB write-fail behavior: pause + retry + escalate
On write failure to BYODB: pause backups for the Space, fire alert, retry every 5 min for 24h, then escalate to CSM. Resolved (B7).

### Dedicated PG migration cadence: upgrade-event only for V1
No proactive Pro → Dedicated migration in V1. Resolved (B8).

## Risks / Trade-offs

- **[Risk] Trigger.dev pricing at scale** → Validate cost projection in staging; cap concurrent jobs per Org if needed; budget alerts on the Trigger.dev account.
- **[Risk] DO contention under high parallelism on a shared Connection** → Per-Connection lock with 5-second retry; load test with N-Space-1-Connection scenarios; if contention starves callers, introduce fair queuing.
- **[Risk] Mid-run overage cap pause leaves orphaned data in client DB** → Pause is at base boundaries; audit log captures the partial state; resume re-uses the same `backup_runs` row.
- **[Risk] BYODB customer outage blocks backups indefinitely** → 5-min retry for 24h; CSM escalation; clear notification cadence to customer.
- **[Risk] Webhook forward failure between `baseout-webhook-ingestion` and `baseout-backup`** → If the per-Space DO is unreachable during a `baseout-backup` deploy, the receiver returns 503 so Airtable retries; brief delivery delay but no data loss.
- **[Trade-off] Static-on-BYOS no-disk-write means we cannot resume a crashed run from where it stopped** → Acceptable for V1; document in product copy.
- **[Trade-off] Per-table client DB schema means schema migrations are runtime concerns** → Engine handles ALTER TABLE during dynamic backup; complex but ergonomically far better for SQL REST and Direct SQL than JSONB.
- **[Trade-off] Cross-repo contract overhead** → Forwards from webhook-ingestion + inbound-api add a service-binding hop. Sub-millisecond on Cloudflare; acceptable.

## Migration Plan

### Build sequence (mirrors the original `Back_Implementation_Plan.md` phases, scoped to `baseout-backup`):

1. **Phase 0 — Foundation**: `apps/backup/` repo + CI/CD, one Cloudflare Workers project per environment with route + cron + DO + R2/D1 bindings, secrets, `@baseout/db-schema` consumed, Trigger.dev account, DigitalOcean shared PG, Neon/Supabase accounts.
2. **Phase 1 — Backup Engine MVP**: Airtable client, per-Connection DO, per-Space DO, static backup → R2, attachment dedup, trial cap, run-trigger endpoint. **Cross-repo checkpoint:** `baseout-web` wizard Phase 2 calls `/runs/{id}/start`.
3. **Phase 2 — Restore + Storage Destinations + Background Services Foundation**: restore engine end-to-end, all 7 storage destinations, webhook renewal cron, OAuth refresh cron, connection-lock manager, WebSocket live progress.
4. **Phase 3 — Dynamic Backup + Schema Diff + Health Score**: DB provisioning across all four tiers, dynamic backup (schema-only + full), tier migration, schema diff persistence + read endpoint, health score persistence + read endpoint.
5. **Phase 4 — Webhook Coalescing + Inbound Forwarding + Dead-Connection Cadence + On2Air Migration**: per-Space DO event coalescing (forwarded from `baseout-webhook-ingestion`), `/inbound/{type}` ingestion endpoints (forwarded from `baseout-inbound-api`), dead-connection cadence, trial-expiry monitor, quota monitor, smart-cleanup scheduler, On2Air migration script.
6. **Phase 5 — Direct SQL + Credit Hardening**: Direct SQL credentials + rotation surfacing endpoint, mid-run overage cap pause, Stripe metered usage reporting cron.
7. **Phase 6 — Email Templates + Pre-Launch Hardening**: All `baseout-backup`-owned React Email templates, Logpush + tail Workers, on-call routing, error-rate alerts, load + stress test, security review.

### Migration of existing customers
The On2Air migration script (Phase 4) is the only data-migration concern for V1 launch. It is run once before public launch; idempotent re-run protects against partial failure.

### Rollback strategy
- Each Trigger.dev job is per-base; failed runs leave `backup_run_bases` rows showing partial state. The next scheduled run resumes from current Airtable state.
- Tier migration: explicit rollback path keeps the old DB active on failure.
- DO state: rebuilds from master DB on cold start; no DO-side persistence is authoritative.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| B1 | Client DB record layout | **Resolved**: dynamic per-table with JSONB for varying-shape fields. |
| B2 | Per-Connection DO vs. simple per-Space rate limiter | **Resolved**: per-Connection DO required. |
| B3 | Trigger.dev V3 pricing at scale | Validate post-staging; cap concurrent jobs per Org if needed. |
| B4 | Stripe metered usage reporting | **Resolved**: `baseout-backup`-direct. |
| B5 | Smart cleanup for static-only customers | **Resolved**: master-DB `static_snapshots` table. |
| B6 | Webhook gap-detection threshold | **Resolved**: 24h OR 3 zero-fetches with modified records. |
| B7 | BYODB write-fail behavior | **Resolved**: pause + 5-min retry for 24h + CSM escalation. |
| B8 | Dedicated PG migration cadence | **Resolved (V1)**: upgrade-event only. |
