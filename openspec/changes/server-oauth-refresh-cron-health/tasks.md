# Tasks

## 1. Design decision + wiring

- [x] 1.1 Record the clock choice in design.md: → Worker cron (the sweep needs master DB + CONNECTION_DO + key-adjacent machinery; Trigger.dev runner must never hold the encryption key). Full rationale in design.md. Worker cron trigger (the existing TODO block) vs Trigger.dev schedule (the only mechanism observed working in dev today, e.g. `cleanup-expired-snapshots`). Default: Worker cron per the original `server-cron-oauth-refresh` design; document why if diverging.
- [x] 1.2 Enable the trigger in `wrangler.jsonc.example` (+ launch.mjs rendering) and implement the `event.cron` dispatch router in `index.ts` `scheduled()` — thin, so `server-run-reconciliation` and future crons plug in per-cron.
- [x] 1.3 **Correction discovered at apply time:** no batch sweep existed — `server-cron-oauth-refresh` built primitives + the on-demand DO path only. Built the sweep here (`lib/cron/oauth-refresh-sweep.ts`, pure; drives each stale connection through ConnectionDO `/token`, design Decision 2) and the dispatch router (`lib/cron/dispatch.ts`); TDD'd both (7 tests). Connect the dispatch to the airtable-refresh machinery; TDD the router (right cron string → right job; unknown cron → logged no-op).

## 2. Observability

- [x] 2.1 Structured sweep summary log (scanned/refreshed/failed/pending_reauth).
- [x] 2.2 Stale-token gauge → `GET /api/internal/connections/token-health` returning `{activeExpired}`; routing tests (401/405); happy path exercised in the dev drill. Stale-token gauge (count of `active` connections with `token_expires_at < now()`) on an INTERNAL_TOKEN-gated probe; test both zero and non-zero cases.

## 3. Verification

- [x] 3.1 typecheck + targeted suites green (tsc clean; 22 tests across cron-dispatch, token-health, whoami, middleware, resolver suites).
- [x] 3.2 Dev drill PASSED 2026-07-15T02:00Z: deployed with `schedule: */15 * * * *`; gauge read `activeExpired: 1` (token expired since 01:15Z); the 02:00:12Z firing refreshed it (`modified_at` 02:00:12Z, `expires_at` → 03:00Z) with NO on-demand call; gauge read 0 at 02:00:42Z. Dev drill: deploy, let the stale dev connection (expired since 2026-07-10 whenever left untouched) get picked up by the first firing; confirm `token_expires_at` advances with NO on-demand call involved, and the gauge reads 0 afterward.
- [x] 3.3 Proportionality note: dev fleet has ONE eligible connection — the sweep opened one short-lived per-request client (+1 inside the DO), torn down in `finally` (code-verified). The 25-cap pressure question only becomes real when the fleet exceeds ~25 connections; re-measure before any cadence tightening. Watch dev PG connection usage across two firings (the ~19-conn budget; per-request client teardown) before considering a tighter cadence.
- [x] 3.4 Update `server-cron-oauth-refresh` tasks.md with a pointer (done — header note added) (its cron-wiring intent lands here) — don't duplicate its remaining prod-gating tasks.
