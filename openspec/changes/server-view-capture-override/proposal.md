# server-view-capture-override

## Why

`system-per-space-db` task 8.2 (enforced 2026-07-23) gates `bo_at_views` capture to Airtable-Enterprise connections: the engine's `/schema-sync` resolves `connections.platform_config.is_enterprise_scope` per run and strips views from non-Enterprise captures. The gate is spec-correct ("included, but capture gated to Airtable Enterprise customers; empty otherwise" — design.md Open items, resolved 2026-06-22), but enforcing it surfaced two operational gaps:

1. **Dev and staff demos lose view capture entirely.** Our dev Airtable connections are not Enterprise-scoped, so from the first gated sync onward no view rows are captured in dev — the Browse tab's Views section stops reflecting reality, and there is no way to exercise or demo the view-capture path short of a real Enterprise Airtable account. This mirrors the problem `openside.com staff get full access` solved web-side (staff orgs auto-resolve to enterprise *Baseout* capabilities via `applyInternalAccess`), but that override keys off the Baseout subscription tier — it cannot open a gate keyed off the *customer's Airtable plan*, and the engine has no staff-detection surface at all (no `users`/membership mirrors).

2. **Ungated-era view rows go permanently stale-active.** Views captured before the gate shipped keep `status='active'` forever on non-Enterprise Spaces — the diff deliberately leaves them untouched to avoid false "removed" churn, but "active with a frozen `last_seen_run`" silently misrepresents state the engine can no longer observe. The per-Space lifecycle model already has the honest state for this: `unknown` ("absent from a non-confident enumeration — never false-delete").

## What Changes

- **Engine env-var override `VIEW_CAPTURE_OVERRIDE`** (`apps/server`): when set to `"1"`, `/schema-sync` treats every connection as view-capture-enabled, bypassing the `is_enterprise_scope` resolution. Set in `apps/server/.dev.vars` for the dev Worker only (auto-synced by `deploy:dev` per CLAUDE.md §3.3); never set on staging/production, so the customer-facing gate is untouched there.
- **Unknown-sweep for gated syncs**: when a sync runs with the gate closed (`viewCapture=false`), the engine flips that base's still-`active` `bo_at_views` rows to `status='unknown'` in the same transaction. Idempotent; reappearance is already handled — if the gate later opens (Enterprise reconnect, or the override), the normal insert/seen upsert flips rows back to `active`.
- The schema-sync response's existing `viewCapture` field additionally reports `"override"` when the env var (not the connection) opened the gate, so smoke runs can tell the two apart.

## Non-Goals

- **No per-org / staff-org override.** A per-connection or staff-detection override would need engine mirrors of `users` + org membership (or a `platform_config` flag written by hand). The env var covers the actual need (dev + demo) with zero DB surface; revisit only if a real staff demo on staging needs views.
- **No web UI badge** ("views not captured — requires Airtable Enterprise" in the Browse tab). That is a `web-*` follow-up; the `viewCapture` response field is the seam it would read from.
- **No change to the incremental path** — `updateView` events stay skipped (full runs own view capture; see `system-per-space-db` 8.2 notes).

## Impact

- `apps/server` only: `src/pages/api/internal/spaces/schema-sync.ts`, `src/lib/per-space/view-capture.ts`, `src/lib/per-space/space-db-pg.ts` (or a small io helper), `src/env.ts` typing, `.dev.vars` (+ `.dev.vars.example` if present).
- No master-DB or per-Space schema migration. No wire-shape change (response field widens `boolean` → `boolean | "override"`, additive for the workflows caller which ignores it).
- Related: parent `system-per-space-db` (8.2); sibling `workflows-incremental-view-refresh` (the other behavior note from the same slice — independent, no shared code).
