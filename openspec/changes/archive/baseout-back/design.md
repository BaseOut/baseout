## Context

Baseout's back surface is consolidated into a single git repo `baseout-server`, deployed as one Cloudflare Workers project. The Worker hosts every back-side runtime concern: HTTP routes (REST endpoints, webhook receivers), cron triggers (the seven background services), Durable Objects (per-Connection rate-limit gateway + per-Space backup state machine), Trigger.dev integration (one workflow per base backup), the SQL REST API endpoint, and Astro SSR routes that render the super-admin surface on a distinct admin hostname. The backup engine sits at the heart of the product — it must hold rate-limited Airtable connections open across long workflows, capture data through memory without ever landing on disk for static-on-BYOS, write to four different client-DB tiers (D1, Shared PG, Dedicated PG, BYODB), and stream attachments to seven destination types. The choice of runtime (Cloudflare DOs + Trigger.dev) and the cross-service contract with front were made in `Back_PRD.md` V1.0; this design captures the rationale, including the V1.1 decision to consolidate the originally-three back projects into one.

Stakeholders: engineering (the `baseout-server` team owning all of backup engine, background services, and super-admin surface), operations (super-admin users + on-call), front team (consumers of `/runs/{id}/start`, `/restores/{id}/start`, WebSocket DO endpoint, `/inbound/*`, `/spaces/{id}/schema|changelog|restore-bundle`), customers (especially Pro+ for Instant Backup, SQL REST API; Business+ for Direct SQL).

Constraints carried in from product:
- **Privacy differentiator**: static-on-BYOS runs MUST stream through memory only — no record data on Baseout disk.
- **Schema package owned by front**: back imports `@baseout/db-schema` and never redefines tables.
- **Email ownership lives with the side that detects the trigger** (no central dispatch).
- **Trigger.dev for backup workflows** (not Workers cron) — needed for unlimited concurrency and no per-run time limits.
- **Per-Connection rate-limit gateway** — multiple Spaces can share an Airtable Connection; serialized at the Connection level.

## Goals / Non-Goals

**Goals:**
- A single Trigger.dev workflow per base can run unbounded with no per-run time limit and parallel across bases.
- Per-Connection DO holds the OAuth token and rate-limit budget so simultaneous Spaces sharing a Connection cannot collide on Airtable's per-account rate limits.
- Live progress emits structured events on a stable WebSocket path that front depends on across the run lifecycle.
- Client-DB tier migrations are reversible mid-flight and decommission the old DB only after a 7-day grace period.
- Webhook ingestion is durable across short outages via cursor-tracking and falls back to full re-read on long gaps.
- Background services are individually idempotent; double-invocation never sends duplicate notifications.
- The credit ledger pauses long-running backups mid-run when an overage cap is reached, rather than letting them blow past the cap.
- Operator tooling (super-admin Astro routes within `baseout-server`) covers every state the customer-facing system can land in, with an immutable audit trail.

**Non-Goals:**
- Record-level restore (deferred to V1.1+).
- Cross-base restore.
- AI Insights (V2).
- MCP / RAG / chatbot / vector DB (V2).
- Automated proactive Pro → Dedicated PG migration (only triggered on upgrade event in V1).
- Built-in customer-DB backup management for BYODB (customer owns it).

## Decisions

### Single consolidated Workers project (vs. three separate projects)
All back-side runtime concerns live in one `baseout-server` Cloudflare Workers project: HTTP handlers, cron triggers, Durable Objects, Trigger.dev integration, the SQL REST endpoint, and Astro SSR routes for the super-admin surface (served via the Astro Cloudflare adapter on a distinct admin hostname). One `wrangler.toml` per environment binds all of this together. Reason: shared code (DB schema consumption, encryption helpers, Mailgun client, audit-log writers, telemetry) collapses into one module graph; deploys, secrets, observability, and CI all run as a single pipeline; the boundary between "what runs on cron" and "what runs on a request" disappears since it's the same Worker. Trade-offs: the deploy blast radius is the entire back surface (a bad deploy takes down everything at once — mitigated by staging gating, tail Workers, and Cloudflare's instant rollback); the Worker bundle is bigger; admin auth must remain logically isolated even though it shares the runtime. Alternatives considered: three separate Workers/Pages projects (rejected for ergonomic + maintenance overhead at V1 scale) and "monorepo with three deploy targets" (rejected — three deploy artifacts have all the cost of three projects without the simplification).

### Cloudflare Durable Objects + Trigger.dev V3 (vs. only Workers cron)
We split orchestration across DOs (state, rate-limit gateway, live progress) and Trigger.dev V3 (per-base workflow execution). Trigger.dev gives unlimited concurrency and no time limits per job, which Workers cron cannot match for multi-hour backups of large bases. DOs give the per-Connection serialization that pure Trigger.dev workers lack. Trade: Trigger.dev pricing must be validated post-staging (B3); cap concurrent jobs per Org if needed. Alternative considered: pure Cloudflare Workers + Queues. Rejected because of CPU/time limits on individual workers and lack of a workflow primitive at the time of decision.

### Custom SQL REST Worker (vs. PostgREST)
Custom Worker on `sql.baseout.com`, not PostgREST. Reason: better control over query parsing for read-only enforcement, rate limiting, credit consumption, and connection pooling. PostgREST adds operational complexity and a less-friendly auth/rate-limit story. Resolved during V1 spec lock; PostgREST rejected.

### Per-Connection DO required (vs. simple per-Space rate limiter)
Per-Connection DO is mandatory because one Airtable Connection can serve multiple Spaces (V1: up to 2 connections per Space; V2: one Connection may serve many Orgs). A per-Space limiter would let two Spaces sharing a Connection blow Airtable's per-account quota. Resolved (B2).

### Stripe metered usage reporting from back, not via front
Back already holds Stripe credentials for read-only use (subscription state) and is the side that produces the overage transactions. Reporting metered usage from back avoids a period-close coordination dance with front. Resolved (B4).

### Client DB record layout: dynamic per-table (vs. generic JSONB)
One PG table per Airtable Table (schema-evolving) for native SQL ergonomics, with JSONB fallback for fields with varying shape (linked records, attachments). This matters most for SQL REST API ergonomics and Direct SQL UX. Resolved (B1) — ergonomics + queryability outweigh the schema-evolution operational cost.

### Webhook gap-detection threshold: 24h or 3 zero-event fetches with modified records
Full re-read fallback fires when `last_known_cursor` is older than 24h OR three consecutive webhook fetches return zero events while records were modified. This balances over-reading (waste) against under-reading (missed change capture). Resolved (B6).

### Email templates: single set in the consolidated repo
All back-owned React Email templates live in one place — `baseout-server/src/emails/` — under the consolidated repo. The previous open question (B10) about duplicating templates between two repos is moot now that there's only one repo; templates are imported wherever the trigger fires (cron handler, Trigger.dev workflow callback, request handler). Resolved.

### Super-admin audit retention: 24 months
Default 24 months in master DB, archive to R2 thereafter. Resolved (B9). Compliance vs cost tradeoff; 24 months covers typical audit-trail asks without unbounded growth.

### Smart cleanup for static-only customers
Static snapshots tracked in a master-DB `static_snapshots` table; cleanup deletes from R2 / customer destination + master row. Resolved (B5) — gives a single place to track snapshots regardless of whether the Space has a client DB.

### BYODB write-fail behavior: pause + retry + escalate
On write failure to BYODB: pause backups for the Space, fire alert, retry every 5 min for 24h, then escalate to CSM. Resolved (B7).

### Dedicated PG migration cadence: upgrade-event only for V1
No proactive Pro → Dedicated migration in V1. Resolved (B8); proactive migration is V2.

## Risks / Trade-offs

- **[Risk] Trigger.dev pricing at scale** → Validate cost projection in staging (Phase 7C load test); cap concurrent jobs per Org if needed; budget alerts on the Trigger.dev account.
- **[Risk] DO contention under high parallelism on a shared Connection** → Per-Connection lock with 5-second retry; load test with N-Space-1-Connection scenarios; if contention starves callers, introduce fair queuing.
- **[Risk] Mid-run overage cap pause leaves orphaned data in client DB** → Pause is at base boundaries (after the in-flight Trigger.dev job finishes its current base); audit log captures the partial state; resume re-uses the same `backup_runs` row.
- **[Risk] BYODB customer outage blocks backups indefinitely** → 5-min retry for 24h; CSM escalation; clear notification cadence to customer.
- **[Risk] Webhook gap missed by both 24h and 3-fetch thresholds** → Conservative defaults; `cleanup_runs`-style audit row records every fallback re-read so we can tune thresholds from real data.
- **[Trade-off] Static-on-BYOS no-disk-write means we cannot resume a crashed run from where it stopped** → Acceptable for V1 — most static runs are short; restart-from-scratch is acceptable; document in product copy.
- **[Trade-off] Per-table client DB schema means schema migrations are runtime concerns** → Engine handles ALTER TABLE during dynamic backup; complex, but ergonomically far better for SQL REST and Direct SQL than JSONB.
- **[Risk] Single Workers deploy = single point of failure** → All back functionality ships in one `wrangler deploy`. A bad deploy takes down the backup engine, the cron handlers, the SQL REST endpoint, and the admin surface together. Mitigated by staging gating, Cloudflare instant rollback, deploy-time canaries, and pre-deploy smoke tests against a staging account. Accepted because the alternative (three separate deploy pipelines) costs more day-to-day than the rare bad-deploy event.
- **[Trade-off] Larger Worker bundle** → All routes, cron handlers, DOs, and Astro SSR pages share one bundle. Bundle size matters for Workers cold-start. Mitigate by treating large dependencies (Trigger.dev SDK, DB drivers, Astro static assets) as code-split where possible and monitoring bundle size in CI.
- **[Trade-off] Admin auth shares the same Worker as customer-facing endpoints** → Logical isolation only, not runtime isolation. A code path bug could in principle expose admin-only data on a customer hostname. Mitigate by routing admin paths through a distinct middleware that requires Google SSO and explicitly rejects requests on non-admin hostnames; cover with integration tests that assert customer-hostname routes never reach admin handlers.

## Migration Plan

### Build sequence (mirrors `Back_Implementation_Plan.md` phases)

1. **Phase 0 — Foundation**: `baseout-server` repo + CI/CD, one Cloudflare Workers project per environment with route + cron + DO + R2/D1 bindings in a single `wrangler.toml`, secrets, `@baseout/db-schema` consumed, Trigger.dev account, DigitalOcean shared PG, Neon/Supabase accounts.
2. **Phase 1 — Backup Engine MVP**: Airtable client, per-Connection DO, per-Space DO, static backup → R2, attachment dedup, trial cap, run-trigger endpoint. **Cross-side checkpoint:** front wizard Phase 2 calls `/runs/{id}/start`.
3. **Phase 2 — Restore + Storage Destinations + Background Services Foundation**: restore engine end-to-end, all 7 storage destinations, webhook renewal cron, OAuth refresh cron, connection-lock manager, WebSocket live progress. **Cross-side checkpoint:** front Phase 3 connects to the WebSocket.
4. **Phase 3 — Dynamic Backup + Schema Diff + Health Score**: DB provisioning across all four tiers, dynamic backup (schema-only + full), tier migration, schema diff persistence + read endpoint, health score persistence + read endpoint.
5. **Phase 4 — Webhook Ingestion + Inbound Forwarding + Dead-Connection Cadence + On2Air Migration**: ingestion endpoint + DO coalescer, `/inbound/*` ingestion endpoints for back, dead-connection cadence, trial-expiry monitor, quota monitor, smart-cleanup scheduler, On2Air migration script.
6. **Phase 5 — SQL REST API + Direct SQL + Credit Hardening**: SQL REST Worker on `sql.baseout.com`, Direct SQL credentials + rotation, mid-run overage cap pause, Stripe metered usage reporting cron.
7. **Phase 6 — Super-Admin Surface**: Astro SSR routes inside `baseout-server` (Astro Cloudflare adapter), hostname-based routing (`admin.baseout.com`), Google SSO middleware, all capability surfaces, audit log immutability.
8. **Phase 7 — Email Templates + Pre-Launch Hardening**: All back-owned React Email templates, Logpush + tail Workers, on-call routing, error-rate alerts, load + stress test, security review.

### Migration of existing customers
The On2Air migration script (Phase 4G) is the only data-migration concern for V1 launch. It is run once before public launch; idempotent re-run protects against partial failure.

### Rollback strategy
- Backup engine: each Trigger.dev job is per-base; failed runs leave `backup_run_bases` rows showing partial state. The next scheduled run resumes from current Airtable state.
- Tier migration: explicit rollback path keeps the old DB active on failure (see `database-provisioning` spec).
- DO state: rebuilds from master DB on cold start; no DO-side persistence is authoritative.
- Super-admin surface: hostname-routed within `baseout-server`; if buggy, the admin route prefix can be middleware-disabled to return 503 without affecting other routes, or the entire Worker can be rolled back via `wrangler rollback` (rolls back all back functionality together — see the single-deploy-blast-radius risk).

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| B1 | Client DB record layout: dynamic per-table or generic JSONB? | **Resolved**: dynamic per-table with JSONB for varying-shape fields. |
| B2 | Per-Connection DO vs. simple per-Space rate limiter | **Resolved**: per-Connection DO required. |
| B3 | Trigger.dev V3 pricing at scale | Validate post-staging; cap concurrent jobs per Org if needed. |
| B4 | Stripe metered usage reporting — back-direct or via front? | **Resolved**: back-direct. |
| B5 | Smart cleanup for static-only customers | **Resolved**: master-DB `static_snapshots` table. |
| B6 | Webhook gap-detection threshold | **Resolved**: 24h OR 3 zero-fetches with modified records. |
| B7 | BYODB write-fail behavior | **Resolved**: pause + 5-min retry for 24h + CSM escalation. |
| B8 | Dedicated PG migration cadence | **Resolved (V1)**: upgrade-event only; proactive is V2. |
| B9 | Super-admin audit log retention | **Resolved**: 24 months, archive to R2 after. |
| B10 | Email template duplication vs shared package | **Obsolete**: single consolidated `baseout-server` repo means one template set. |
| B11 | Single Workers deploy blast radius | Mitigated by staging gating + `wrangler rollback` + canary deploys; revisit if incident frequency warrants splitting. |
