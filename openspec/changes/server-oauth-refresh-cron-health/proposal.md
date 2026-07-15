# server-oauth-refresh-cron-health — Proposal

## Why

On 2026-07-14 the primary dev Airtable Connection's access token had been expired for **4.7 days** (`token_expires_at` 2026-07-10, `status` still `active`) with zero refresh attempts — surfaced when backup tasks got a stale token and the incident read as "backups broken". Root cause, confirmed in the repo: **no clock ever fires the refresh sweep.** `server-cron-oauth-refresh` (28/33) built the refresh machinery (`src/lib/airtable-refresh.ts`, claim protocol, on-demand DO path), but the Worker cron triggers are still the commented-out `TODO(phase-2)` block in `wrangler.jsonc(.example)` and the top-level `scheduled()` handler is an empty stub — nothing references the sweep from any schedule. Proactive refresh therefore never happens; tokens only refresh when something calls the DO `/token` route on demand, and the documented product intent (refresh cron keeping `*_enc` tokens fresh, oauth-setup.md) is silently unmet.

## What Changes

- **Wire the clock**: enable the cron trigger (`*/15 * * * *` per the existing TODO comment) in `wrangler.jsonc.example` + rendered config, and implement `scheduled()` dispatch by `event.cron` — a thin router so later crons (retention, webhook renewal) plug in without touching each other.
- **Fire the existing sweep**: connect the dispatch to the already-built airtable-refresh machinery; no changes to the refresh/claim logic itself unless 1.x testing exposes a defect.
- **Staleness observability**: extend the sweep's structured logging with scanned/refreshed/failed/pending-reauth counts, and add a stale-token gauge (count of `active` connections with `token_expires_at` in the past) to an internal probe so a dead clock is VISIBLE next time instead of silently rotting for days.
- Decide (design-time) whether dev keeps Worker cron or a Trigger.dev schedule — note the fleet's only working schedules today are Trigger.dev tasks (e.g. `cleanup-expired-snapshots`); the decision and rationale get recorded in the design doc.

## Capabilities

### New Capabilities

- `refresh-cron-health`: a scheduled dispatch that actually fires the OAuth refresh sweep on a clock, with staleness observability that makes a dead schedule detectable.

### Modified Capabilities

None to the refresh algorithm itself — `server-cron-oauth-refresh` owns it; this change gives it a heartbeat and instruments it.

## Impact

- **App:** `apps/server` — `wrangler.jsonc.example` triggers block, `index.ts` `scheduled()` dispatch, sweep logging, internal staleness probe route or `/api/health` extension.
- **Cross-change:** unblocks the same dispatch mechanism for `server-run-reconciliation` (filed together) and future crons; coordinate the `event.cron` router shape.
- **No new secrets.** Deploy note: dev Worker cron triggers take effect on `deploy:dev`.
- **Risk:** a 15-min sweep against the ~19-connection dev PG budget → the sweep already uses per-request clients; verify connection usage in the dev drill before widening cadence.
