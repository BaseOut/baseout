---
title: apps/server — Phase 1 Roadmap (post-PoC)
status: planned
created: 2026-05-05
predecessor_plan: ~/.claude/plans/ok-we-need-to-silly-papert.md
reference_engine: /Users/autumnshakespeare/dev/baseout/baseout-backup-engine/
---

# apps/server — Phase 1 Roadmap

## Where we left off

The PoC committed in this session (see [predecessor plan](~/.claude/plans/ok-we-need-to-silly-papert.md)) gives us a working Cloudflare Worker with:

- Public `/api/health` (200 liveness probe)
- `INTERNAL_TOKEN`-gated `/api/internal/*` (constant-time compare)
- `ConnectionDO` and `SpaceDO` reachable via wrangler bindings (SQLite-backed migration v1)
- Per-request `masterDb` factory shape (`createMasterDb` returns `null`)
- Schema barrel + canonical file structure per CLAUDE.md §5.3
- `.dev.vars` mirroring the team's existing Trigger.dev project (`proj_lklmptmrmrkeaszrmhcs`)
- All six smoke-test curls green

**Reference implementation:** the full working engine lives at [/Users/autumnshakespeare/dev/baseout/baseout-backup-engine/](file:///Users/autumnshakespeare/dev/baseout/baseout-backup-engine/). Port piece by piece. Do **not** wholesale-copy — CLAUDE.md §1.5 forbids drive-by churn.

---

## Phase 1 work items, in suggested order

### 1. Real per-request Postgres in `createMasterDb`

**Why:** Every other phase-1 item depends on writing/reading rows in the master DB. Right now `createMasterDb` returns `null`, so route handlers can't touch the DB.

**What to do:**
- Add runtime deps to [apps/server/package.json](../../../package.json): `drizzle-orm`, `postgres`, `@cloudflare/workers-types` (already present).
- Implement the body of [src/db/worker.ts](../../../src/db/worker.ts) using the postgres-js + drizzle pattern from CLAUDE.md §5.1: `max: 1`, `prepare: false`, wrap teardown with `ctx.waitUntil(sql.end({ timeout: 5 }))` on response.
- Branch on `import.meta.env.DEV`: in dev use `process.env.DATABASE_URL`; in deployed envs use `env.HYPERDRIVE.connectionString`. Vite tree-shakes the dead branch out of the deployed bundle.
- Update [src/env.d.ts](../../../src/env.d.ts) `Env` to include `HYPERDRIVE: Hyperdrive`.
- Uncomment the `hyperdrive` block in [wrangler.jsonc](../../../wrangler.jsonc) — once the Hyperdrive resource exists in Cloudflare account.

**Reference:** existing engine's `src/db/worker.ts`, `src/db/node.ts` (singleton for scripts only).

**Acceptance:** `locals.masterDb` is a real Drizzle client inside handlers. Add a `/api/internal/__db-smoke` route (PoC-style) that runs `select 1` and returns the result.

### 2. First mirrored schema table — `backup_runs`

**Why:** Anything that enqueues a backup writes a row here on start and updates on complete. It's the engine's primary write surface.

**What to do:**
- Create [src/db/schema/backup-runs.ts](../../../src/db/schema/backup-runs.ts) — Drizzle table definition matching the canonical migration in `apps/web/drizzle/`. Header comment names the canonical migration source (CLAUDE.md §2 mandate). Mirror exactly: don't invent columns.
- Re-export from [src/db/schema/index.ts](../../../src/db/schema/index.ts).
- Confirm column types/constraints match before writing — check `apps/web/drizzle/` for the canonical schema. If frontend hasn't landed it yet, **defer**: surface to user as a blocker and don't invent a table on the engine side.

**Reference:** existing engine's `src/db/schema/backup-runs.ts`.

**Acceptance:** an internal route can insert a `backup_runs` row and read it back via `locals.masterDb`.

### 3. Trigger.dev v3 wiring

**Why:** The actual backup work runs in Trigger.dev (Node runtime, no time limit), not in the Cloudflare Worker. The Worker just enqueues tasks.

**What to do:**
- Add deps: `@trigger.dev/sdk`, `@trigger.dev/build` (dev).
- Create [trigger.config.ts](../../../trigger.config.ts) — port verbatim from [/Users/autumnshakespeare/dev/baseout/baseout-backup-engine/trigger.config.ts](file:///Users/autumnshakespeare/dev/baseout/baseout-backup-engine/trigger.config.ts) (project ref already matches via `.dev.vars`). The docstring header explains the runner-vs-Worker boundary.
- Create [trigger/tasks/](../../../trigger/) directory and port one task — start with a no-op `ping` task to prove the deploy + invoke loop end-to-end.
- Create [src/lib/trigger-client.ts](../../../src/lib/trigger-client.ts) — thin wrapper around `tasks.trigger()` for handler use.
- Add `TRIGGER_SECRET_KEY` to [src/env.d.ts](../../../src/env.d.ts) and ensure it propagates to the SDK at task-enqueue time (read from `env`, not `process.env`).
- Add a `/api/internal/__trigger-smoke` route that enqueues the no-op task and returns the run ID.

**Reference:** existing engine's `trigger/`, `src/lib/trigger-client.ts`, `src/pages/api/internal/runs/start.ts`.

**Acceptance:** `curl -H "x-internal-token: $INTERNAL_TOKEN" .../api/internal/__trigger-smoke` returns a Trigger.dev run ID; the run shows up in https://cloud.trigger.dev under `proj_lklmptmrmrkeaszrmhcs`.

### 4. SpaceDO and ConnectionDO real implementations

**Why:** PoC stubs just return their ID. Real engine logic lives here:
- `ConnectionDO` — leaky-bucket throttling per Connection, OAuth refresh handoff, lock state.
- `SpaceDO` — scheduled-backup state machine, task dispatch, alarm-driven scheduling.

**What to do:**
- Port [/Users/autumnshakespeare/dev/baseout/baseout-backup-engine/src/durable-objects/ConnectionDO.ts](file:///Users/autumnshakespeare/dev/baseout/baseout-backup-engine/src/durable-objects/ConnectionDO.ts) and `SpaceDO.ts` carefully — these are the most complex files in the engine. Bring tests when you bring code.
- Port any helper modules they depend on (likely a shared rate-limit util, alarm scheduler, etc.).
- Wire up the WebSocket handler on `SpaceDO` for real-time backup progress (consumed by `apps/web` dashboard).

**Acceptance:** an internal route on the Worker can `env.SPACE_DO.get(id).fetch(...)` to start a scheduled backup; the DO writes a `backup_runs` row, dispatches a Trigger.dev task, and broadcasts state to any connected WebSocket subscribers.

### 5. R2 binding + streaming output

**Why:** Backups write CSV per table to R2 (managed storage default). Trigger.dev tasks stream rows directly to R2 — never buffer a whole base in memory (PRD §7.2).

**What to do:**
- Add `r2_buckets` binding in [wrangler.jsonc](../../../wrangler.jsonc) — uncomment and point at `baseout-backups` bucket.
- Update [src/env.d.ts](../../../src/env.d.ts) with `BACKUP_BUCKET: R2Bucket`.
- Port the streaming write helper from the existing engine. Watch for the file-path convention: `/{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv` (Implementation Plan §1B).

**Acceptance:** a Trigger.dev backup task writes a real CSV to the R2 bucket; the bucket can be listed via `wrangler r2 object list`.

### 6. HMAC service tokens (replace bearer `INTERNAL_TOKEN`)

**Why:** PoC uses a shared bearer token. Per CLAUDE.md §3.3, service-to-service calls beyond the simplest case want signed HMAC tokens with replay protection.

**What to do:**
- Wait for [packages/shared/src/hmac.ts](../../../../../packages/shared/src/hmac.ts) to land (currently `export {}`). Phase 1 of `@baseout/shared` should implement `signServiceToken` + `verifyServiceToken`.
- Update [src/middleware.ts](../../../src/middleware.ts) to verify HMAC signatures on `/api/internal/*` routes; keep the bearer-token branch as a fallback if `x-internal-signature` header is absent (gradual migration).
- Update `apps/web` to send signed tokens.

**Acceptance:** internal routes accept HMAC-signed requests; replay attempts (same nonce within window) are rejected with 401.

### 7. Cron handlers for background services

**Why:** The engine also hosts background services (per PRD §18.4 the original `baseout-background-services` repo): webhook renewal, OAuth refresh, trial-expiry, quota monitor, smart cleanup.

**What to do:**
- Uncomment the `triggers.crons` block in [wrangler.jsonc](../../../wrangler.jsonc).
- Implement the `scheduled` handler in [src/index.ts](../../../src/index.ts) — switch on `event.cron` to dispatch.
- Port each cron handler from the existing engine, one at a time.

**Acceptance:** `wrangler dev --test-scheduled` triggers each cron and the handler does the right thing.

### 8. Vitest integration tests

**Why:** CLAUDE.md §3.4 mandates TDD. The middleware token gate is non-trivial enough that phase 1's first commit should be a failing test for it.

**What to do:**
- Add `@cloudflare/vitest-pool-workers` (dev). Create [vitest.config.ts](../../../vitest.config.ts) following the apps/web pattern.
- First test: `middleware.applyMiddleware` for the four token branches (no token, wrong token, correct token, public path).
- Then: `health` handler returns expected shape, `ConnectionDO.fetch` returns expected shape.
- Coverage target per PRD §14.4: 80% unit on backend logic.

**Acceptance:** `pnpm --filter @baseout/server test` is green; CI runs it.

### 9. Service bindings from `apps/api`, `apps/hooks`

**Why:** Other Workers in the monorepo (`apps/api` for public API, `apps/hooks` for webhooks) call into the engine via service bindings, not HTTP.

**What to do:**
- Wait until those apps have real entry points to bind from.
- Configure service bindings via Cloudflare dashboard once the Workers exist (per existing comment in [wrangler.jsonc](../../../wrangler.jsonc)).

**Acceptance:** `apps/api` can call a method on the engine via `env.BACKUP_ENGINE.fetch(...)` without crossing the public internet.

### 10. Production-deploy hardening

**Why:** Until then we've only been running `wrangler dev`. Production has different bindings (Hyperdrive ID, R2 bucket name, Email binding, real secrets).

**What to do:**
- Fill in `env.production` and `env.staging` in [wrangler.jsonc](../../../wrangler.jsonc) with the right binding IDs once the Cloudflare resources exist.
- Run `wrangler secret put INTERNAL_TOKEN`, `TRIGGER_SECRET_KEY`, `MASTER_ENCRYPTION_KEY`, etc., per environment.
- Add CI step: `wrangler deploy --env staging` on PR merge to `main`; production deploys on tag.

**Acceptance:** `wrangler deploy --env staging` succeeds; `curl https://baseout-server-staging.<account>.workers.dev/api/health` returns 200.

---

## Items not in this roadmap (out of scope for phase 1)

- Public REST API surface (lives in `apps/api`, not here)
- Direct SQL access (lives in `apps/sql`)
- Admin observability UI (lives in `apps/admin`)
- Frontend ops console (lives in `apps/web/src/pages/ops/`)
- Anything UI-shaped — engine has no UI per CLAUDE.md §5.2

---

## Open questions to surface before phase 1 starts

1. **Has `apps/web/drizzle/` landed the canonical `backup_runs` migration yet?** If not, item 2 (first mirrored table) is blocked. The frontend owns the schema; the engine mirrors.
2. **Does Cloudflare account have a Hyperdrive resource provisioned?** If not, item 1 falls back to direct postgres connection (works in dev, slower in production).
3. **Is the existing `proj_lklmptmrmrkeaszrmhcs` Trigger.dev project the one we want to keep using long-term?** The PoC binds to it via the values in `.dev.vars`. If the team wants a fresh project for the monorepo, swap before item 3.
4. **Are `@baseout/shared` and `@baseout/db-schema` getting real implementations soon?** Several items (HMAC, real schema mirror) depend on those packages going beyond `export {}`.

---

## How to pick this back up

1. Read the [predecessor plan](~/.claude/plans/ok-we-need-to-silly-papert.md) to remember the PoC scope.
2. Re-run the six curl smoke tests to confirm the PoC still works after any rebase.
3. Pick the next unstarted item from the list above. Most have a "reference" pointer to the file in `/Users/autumnshakespeare/dev/baseout/baseout-backup-engine/` — that's the playbook.
4. Each item should land as its own PR with tests. CLAUDE.md §3.4 (TDD) and §3.5 (no-console) apply.
