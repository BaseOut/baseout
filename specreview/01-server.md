## apps/server — backup/restore engine

> **Note (2026-05-13 update):** R2 has been removed from `apps/server` (commit `8fc1f61`). Schedule-and-cancel Phase A shipped. SpaceDO alarm scaffold landed (Phase B partial). See [05-update-2026-05-13b.md](./05-update-2026-05-13b.md) for the detailed delta.



### Spec identity

Headless Cloudflare Worker. Per `CLAUDE.md` §5.2:

- Public: `/api/health` (liveness probe)
- Internal: `/api/internal/*` gated by `x-internal-token` header (`INTERNAL_TOKEN`)
- Reached by `apps/web` via service binding (`BACKUP_ENGINE`), not public HTTP
- No UI, no `/login`, no `/api/auth/*`, no `better-auth`, no per-engine user identity
- Hosts Durable Objects (`ConnectionDO`, `SpaceDO`)
- Runs Trigger.dev v3 tasks
- Writes backup output to R2 / BYOS
- Master-DB schema owned by `apps/web`; server mirrors specific tables

### Canonical proposal: `baseout-backup`

The OpenSpec change `baseout-backup` describes the data plane. Capabilities defined:

| Capability | Purpose |
|---|---|
| `backup-engine` | Static + dynamic backup, scheduled + manual + webhook triggers, trial cap, attachment dedup, audit reports |
| `restore-engine` | Base / table / point-in-time restore, post-restore verification (Growth+), Community Restore Tooling AI bundles (Pro+) |
| `storage-destinations` | Common `StorageWriter` interface for R2 + 6 BYOS providers |
| `database-provisioning` | D1 / Shared PG / Dedicated PG / BYODB + tier migration |
| `schema-diff` | Diff + changelog + health score (0-100, Green/Yellow/Red bands) |
| `airtable-webhook-coalescing` | Per-Space DO event coalescing, cursor advancement, gap fallback, webhook lifecycle |
| `background-services` | 7 cron-triggered handlers (webhook renewal, OAuth refresh, dead-conn cadence, trial expiry, quota, smart cleanup, connection lock) |
| `direct-sql-access` | Read-only PG connection string surface (Business+) |
| `backup-credit-consumption` | Credit ledger, bucket priority, mid-run overage pause, Stripe metered usage |
| `backup-email-notifications` | React Email + Mailgun (audit, failure, trial, dead-conn, quota, schema change, health, restore complete, webhook renewal failure) |
| `on2air-migration-script` | One-shot legacy migration |

### What exists in `apps/server/src/` today (updated 2026-05-13)

```
src/
  index.ts                    Worker entry — dispatches HTTP + scheduled handler
  middleware.ts               INTERNAL_TOKEN constant-time gate + per-request masterDb
  env.d.ts                    Locals + ProvidedEnv typing
  db/
    worker.ts                 createMasterDb() — per-request postgres-js + drizzle
    schema/
      index.ts                barrel
      connections.ts          MIRROR (canonical: apps/web)
      at-bases.ts             MIRROR
      backup-runs.ts          MIRROR
      backup-configurations.ts MIRROR
      backup-configuration-bases.ts MIRROR
      platforms.ts            MIRROR (NEW)
      spaces.ts               MIRROR (NEW)
  durable-objects/
    ConnectionDO.ts           PoC stub
    SpaceDO.ts                Real alarm-driven scheduler (NEW logic per schedule-and-cancel Phase B)
  lib/
    crypto.ts                 AES-256-GCM encrypt + decrypt
    airtable-refresh.ts       Airtable OAuth refresh RPC
    oauth-refresh.ts          Refresh orchestrator (cron tick)
    trigger-client.ts         Trigger.dev SDK wrapper (v4.4.6)
    scheduling/
      next-fire.ts            (NEW) Pure-function next-fire computer for SpaceDO alarm
    runs/
      start.ts
      start-deps.ts           (NEW) Dep extraction
      progress.ts
      complete.ts
      cancel.ts               (NEW) Engine-side cancel handler
  pages/api/
    health.ts                 Public liveness
    internal/
      ping.ts
      db-smoke.ts
      trigger-smoke.ts
      connections/
        whoami.ts             Validates Connection via Airtable
        do-proxy.ts           DO testing helper
      runs/
        start.ts              POST /runs/{id}/start
        progress.ts           POST /runs/{id}/progress
        complete.ts           POST /runs/{id}/complete
        cancel.ts             (NEW) POST /runs/{id}/cancel
      spaces/
        set-frequency.ts      (NEW) POST /spaces/{id}/set-frequency — wires to SpaceDO
trigger/
  tasks/
    _ping.ts
    backup-base.task.ts       Trigger.dev task scaffold
    backup-base.ts            Wires per-base CSV write through local-fs (R2 path REMOVED)
    _lib/
      airtable-client.ts
      csv-stream.ts
      field-normalizer.ts
      local-fs-write.ts       (NEW) Replaces r2-proxy-write.ts
      r2-path.ts              Path-shape helper (name retained though R2 binding is gone)
trigger.config.ts             Trigger.dev project config (maxDuration: 600)
```

**REMOVED in commit `8fc1f61`:** `BACKUPS_R2` binding, `env.BACKUPS_R2`, `r2-proxy-write.ts`, `r2-proxy-write.test.ts`, `runs/upload-csv.ts`, `runs-upload-csv.test.ts`.

### Status against `baseout-backup/tasks.md`

#### Phase 0 — Foundation (mostly done in spirit)
- [x] Project scaffolded as Cloudflare Worker at `apps/server/`
- [x] Wrangler config with INTERNAL_TOKEN, DOs declared
- [x] Vitest + workerd pool wired
- [~] `@baseout/db-schema` not extracted — schema mirrored from `apps/web` inline. Spec assumes the package exists.
- [ ] DigitalOcean shared PG / Neon / Supabase provisioning workflow — not started

#### Phase 1 — Backup Engine MVP (updated 2026-05-13)
- [~] Airtable client — `trigger/tasks/_lib/airtable-client.ts` exists; token-holder + refresh path partial
- [ ] Schema discovery (Metadata API)
- [ ] Record fetch + pagination + 429 handling + cursor advancement
- [ ] Attachment URL refresh (placeholder `[N attachments]` still emitted; gap captured in `baseout-backup-attachments` proposal)
- [ ] Per-Connection DO (rate-limit budget, queue, contention retry) — stub only
- [x] Per-Space DO state machine + cron-like scheduler (Phase B of schedule-and-cancel)
- [ ] Per-Space DO WebSocket emitter
- [~] Trigger.dev backup-per-base — task wired to POST progress per table (commit `486ef60`); core record-fetch + write loop still partial
- [~] CSV streaming — `csv-stream.ts` + `local-fs-write.ts` (R2 path removed; managed-destination model under reconsideration)
- [x] `backup_runs` lifecycle wiring (start/progress/complete handlers + DB row writes)
- [x] Cancel run path (Phase A of schedule-and-cancel: cancel.ts + UI button + status `'cancelling' | 'cancelled'`)
- [ ] `backup_run_bases` per-base verification rows
- [ ] Attachment composite-ID dedup
- [ ] Trial cap enforcement (separate change `baseout-backup-trial-quota-enforcement`)
- [x] `POST /runs/{id}/start` endpoint exists (service-token gated, idempotent shape)
- [x] Run-trigger contract locked with `apps/web` via service binding

#### Phase 2 — Restore + Storage + Background Services Foundation (NOT STARTED)
Everything in this phase is greenfield.

#### Phase 3 — Dynamic Backup + Schema Diff + Health Score (NOT STARTED)
Everything in this phase is greenfield.

#### Phase 4 — Webhook Coalescing + Inbound + Dead-Conn + Trial/Quota/Cleanup + On2Air (NOT STARTED)
Everything in this phase is greenfield. Webhook ingestion + inbound API are spec'd as separate Workers (`baseout-webhook-ingestion`, `baseout-inbound-api`); per `CLAUDE.md` they collapse into `apps/server` — this is the largest unaddressed spec drift.

#### Phase 5 — Direct SQL + Credit Hardening (NOT STARTED)

#### Phase 6 — Email + Pre-Launch (NOT STARTED)

### Openspec changes touching `apps/server` (updated 2026-05-13)

| Change | State |
|---|---|
| `baseout-server-cron-oauth-refresh` | Code ✅ (Phases 1-5), tests ✅, staging deploy verify pending |
| `baseout-web-server-service-binding` | Dev binding live; `whoami` probe wired |
| `baseout-web-server-service-binding-staging-prod` | Pending — needs `baseout-server-staging` + `baseout-server` Workers deployed + Hyperdrive IDs + secrets |
| `baseout-backup-schedule-and-cancel` | Phase A ✅ (cancel); Phase B partial (SpaceDO alarm scheduler) — 21/52 tasks done |
| `baseout-server-spacedo-alarm-test-isolation-fix` | ✅ shipped (`cddff0c`) — 3 SpaceDO tests greened |
| `baseout-backup-attachments` | Proposal only |
| `baseout-backup-byos-destinations` | Proposal only |
| `baseout-backup-dynamic-mode` | Proposal only |
| `baseout-backup-instant-webhook` | Proposal only (depends on dynamic-mode + `apps/hooks` bootstrap) |
| `baseout-backup-retention-and-cleanup` | Proposal only (depends on manual-quota) |
| `baseout-backup-trial-quota-enforcement` | Proposal only |
| `baseout-backup-manual-quota-and-credits` | Proposal only |
| `baseout-backup-automations-interfaces-docs` | Proposal only (depends on `apps/api` bootstrap) |

### Notable existing endpoints

- `POST /api/internal/connections/{id}/whoami` — used by `apps/web` to validate a Connection. Service-binding consumer is in place.
- `POST /api/internal/runs/{id}/start|progress|complete` — wire exists; engine-side handlers stubbed.
- `POST /api/internal/runs/upload-csv` — CSV upload path scaffold.
- `POST /api/internal/connections/do-proxy` — DO testing helper.
- Cron: `*/15 * * * *` for OAuth refresh (activated). Other crons commented in `wrangler.jsonc`.

### Risks / unknowns

1. **DO state machines are stubs.** Real per-Connection rate-limit gateway + per-Space scheduler logic will need careful design — the spec assumes contention retry + 5s lock budget + WebSocket emission, none of which exist.
2. **R2 streaming hasn't been proven.** PRD §7.2 specifies streaming patterns that avoid buffering whole bases in memory. Worker memory caps make this load-bearing.
3. **Trigger.dev concurrency cost.** Spec calls for unlimited concurrency per base; pricing implications not yet validated.
4. **Webhook ingestion collapse.** Per `CLAUDE.md`, webhook ingestion lives in `apps/server` rather than its own Worker. The Airtable webhook receiver needs a public route on this Worker — that's a deviation from the spec's "public surface = only `/api/health`" rule. Surface this before adding the receiver.
