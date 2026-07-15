# Tasks

## 1. Design decision + wiring

- [ ] 1.1 Record the clock choice in design.md: Worker cron trigger (the existing TODO block) vs Trigger.dev schedule (the only mechanism observed working in dev today, e.g. `cleanup-expired-snapshots`). Default: Worker cron per the original `server-cron-oauth-refresh` design; document why if diverging.
- [ ] 1.2 Enable the trigger in `wrangler.jsonc.example` (+ launch.mjs rendering) and implement the `event.cron` dispatch router in `index.ts` `scheduled()` — thin, so `server-run-reconciliation` and future crons plug in per-cron.
- [ ] 1.3 Connect the dispatch to the existing airtable-refresh sweep; TDD the router (right cron string → right job; unknown cron → logged no-op).

## 2. Observability

- [ ] 2.1 Structured sweep summary log (scanned/refreshed/failed/pending_reauth).
- [ ] 2.2 Stale-token gauge (count of `active` connections with `token_expires_at < now()`) on an INTERNAL_TOKEN-gated probe; test both zero and non-zero cases.

## 3. Verification

- [ ] 3.1 typecheck + targeted suites green.
- [ ] 3.2 Dev drill: deploy, let the stale dev connection (expired since 2026-07-10 whenever left untouched) get picked up by the first firing; confirm `token_expires_at` advances with NO on-demand call involved, and the gauge reads 0 afterward.
- [ ] 3.3 Watch dev PG connection usage across two firings (the ~19-conn budget; per-request client teardown) before considering a tighter cadence.
- [ ] 3.4 Update `server-cron-oauth-refresh` tasks.md with a pointer (its cron-wiring intent lands here) — don't duplicate its remaining prod-gating tasks.
