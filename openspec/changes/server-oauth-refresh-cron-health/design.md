# server-oauth-refresh-cron-health — Design

## Context

Confirmed in-repo (2026-07-14): `wrangler.jsonc(.example)` has no active cron triggers (the `TODO(phase-2)` comment block only), `index.ts`'s `scheduled()` is an empty stub, and — correcting the proposal's assumption — **no batch sweep exists at all**: `server-cron-oauth-refresh` built the refresh primitives (`airtable-refresh.ts`) and the on-demand path (`resolve-airtable-token.ts`, driven by ConnectionDO `/token` with `AIRTABLE_ON_DEMAND_REFRESH_ENABLED=1`), but nothing scans for expiring connections. Net effect: tokens only refresh when something asks for them; a quiet connection rots (observed: 4.7 days expired while `status='active'`).

## Goals / Non-Goals

**Goals:** a clock fires a sweep every 15 minutes; a quiet active connection's token never sits expired; a dead clock is observable (stale-token gauge + per-sweep log line); the dispatch mechanism is reusable by the next crons (`server-run-reconciliation`).

**Non-Goals:** changing the refresh algorithm/claim protocol (owned by `server-cron-oauth-refresh`); storage-provider (BYOS) token refresh (its §7.2 follow-up); staging/prod cron enablement (their env blocks are placeholders — enable alongside `shared-server-service-binding-staging-prod`).

## Decisions

1. **Clock: Worker cron trigger, not a Trigger.dev schedule.** The sweep needs the master DB, `BASEOUT_ENCRYPTION_KEY`-adjacent machinery, and the `CONNECTION_DO` binding — all Worker-side. The Trigger.dev runner holds none of these and must never hold the encryption key. (Trigger.dev schedules remain the pattern for Node-side jobs like `cleanup-expired-snapshots`.) Cron: `*/15 * * * *` per the original TODO block, declared inside `env.dev.triggers` (env blocks need their own `triggers`; verified against the wrangler docs) — top-level stays commented until staging/prod env blocks are real.
2. **The sweep drives refreshes through ConnectionDO `/token`, not a parallel code path.** For each stale connection the sweep calls the DO stub's on-demand path (`{connectionId}` body) and discards the returned token. This reuses the exact production claim/refresh/persist flow — including per-connection serialization via `idFromName` — instead of duplicating the resolver's dep wiring outside the DO. Consequence: the sweep is inert when `AIRTABLE_ON_DEMAND_REFRESH_ENABLED` ≠ `"1"` (the DO would take the legacy decrypt path), so it checks the flag first and logs a loud skip.
3. **Selection window matches the resolver exactly.** The sweep selects `active` Airtable connections with a refresh token whose `token_expires_at` is NULL or `<= now() + REFRESH_LOOKAHEAD_MS` (5 min, now exported from `resolve-airtable-token.ts`) — anything looser would count DO no-ops as refreshes; anything tighter would leave a gap.
4. **Bounded + sequential.** Max 25 connections per firing, processed sequentially (bounds dev-PG connection pressure and DO fan-out); when more are stale, the sweep logs `truncated: true` (no silent caps) and the next firing continues. Per-connection failures are caught and counted — one bad connection never aborts the sweep.
5. **Dispatch router is pure and cron-string-keyed.** `resolveCronJobs(cron)` maps `*/15 * * * *` → `["oauth-refresh-sweep"]`; unknown crons log a no-op. `server-run-reconciliation` adds its own entry rather than touching this sweep.
6. **Gauge: `GET /api/internal/connections/token-health`** (INTERNAL_TOKEN-gated like every internal route) returning `{ activeExpired }` — the count of `active` Airtable connections already past `token_expires_at`. Non-zero after a full sweep cycle = the clock or the sweep is broken.

## Risks / Trade-offs

- [DO round-trip per stale connection] → bounded at 25/firing; at dev scale single-digit; revisit batching only with fleet data.
- [Sweep counts a 200 as "refreshed" even if the DO raced another refresher] → acceptable: either way the token IS fresh after the call; the count is a health signal, not an audit log.
- [`updateRunTriggerIds`-style config drift: rendered `wrangler.jsonc` is gitignored] → launch.mjs renders from the example, so the trigger lands in both; the dev drill verifies the deployed cron actually fires.

## Migration Plan

Deploy to dev (`deploy:dev` picks up `env.dev.triggers`); first firing should refresh any stale dev connection with no manual action. Rollback: remove the `triggers` block — the sweep code is inert without a clock.

## Open Questions

| # | Question | Default answer |
|---|---|---|
| C1 | Should the gauge also count `pending_reauth` connections? | Not here — that's a support-surface concern; the admin console reads the column directly. |
| C2 | Staging/prod cadence | Same `*/15`; enable when those env blocks land. |
