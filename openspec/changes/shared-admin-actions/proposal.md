# shared-admin-actions

## Why

The staff console (`apps/admin`) is 100% read-only. PRD [§16.1](../../../shared/Baseout_PRD.md) requires manual admin actions ("force backup, invalidate connection, reset trial, adjust plan"), and the parent [`admin`](../admin/) umbrella extends the list (grant credits, force migration completion) with a hard rule: **every action writes an immutable audit row before it executes**, into an append-only audit trail. None of that exists — there is no `audit_log` table anywhere, and admin has no mutation route, no CSRF layer, and no path to the backup engine.

This change builds the audit foundation plus the three actions whose data paths already exist end-to-end. The other three are billing-coupled and blocked (see "Deferred and why").

## Relationship to the `admin` umbrella

Child of the deferred [`admin`](../admin/) change, in the same spirit as [`admin-foundation`](../admin-foundation/) and [`admin-read-surfaces`](../admin-read-surfaces/). It implements the parent's Phase 3 tasks 4.1 (audit table), 4.2 (write-then-execute), 4.3 (force backup), 4.4 (invalidate connection), 4.8 (force migration), and 4.9 (explicit confirmation) — scoped to the three buildable actions. Parent tasks 4.5–4.7 (trial/plan/credits) and Phase 4 (5.1–5.4: DB-role enforcement, retention/R2 archive, audit search UI) stay deferred in the umbrella.

## What Changes

- **`admin_audit_log` table** (canonical in `apps/web/src/db/schema/core.ts` + `apps/web/drizzle/0025_*.sql` — web owns all master-DB migrations; admin gains a **writable mirror**). Append-only by app-layer discipline; modeled on `connection_status_audit` (db-context columns: `db_user`, `application_name`, `txid`). Uses a **two-row intent/result model**: an `intent` row is INSERTed before the action executes (the spec's "audit before executing"), and a `result` row is appended afterward pointing back via `intent_id`. No UPDATE path exists or is ever added — outcome is a second row, not a mutation. `params` is jsonb so the deferred billing actions need no schema change later.
- **Write-then-execute helper** `runAudited()` in `apps/admin/src/lib/audit.ts`: refuses to execute if the intent INSERT fails; includes the V1 rate limiter (≤10 audited intents per actor per 60s, counted from `admin_audit_log` itself — durable across Worker isolates, unlike in-memory buckets).
- **Three actions** as admin's first POST routes (`apps/admin/src/pages/api/actions/*`), each with a confirmation dialog on the existing read surface:
  - **Force backup** (per-Space button on the Orgs→Spaces tracker): INSERT `backup_runs` (`status='queued'`, `triggered_by='admin'`) then POST the engine's `/api/internal/runs/:id/start` — same contract as web's `startBackupRun`, orphan-row DELETE on engine 4xx included.
  - **Invalidate connection** (per-row button on `/connections`): UPDATE `connections.status='invalid'` (+ `invalidated_at`), then best-effort cancel of `queued|running` runs via the engine's `/runs/:id/cancel`. The existing `connection_status_audit` Postgres trigger (web migration 0015) independently corroborates the flip.
  - **Force migration completion** (per pending-org button on `/migration`): UPDATE `organizations.has_migrated = true`.
- **CSRF layer**: strict same-origin `checkOrigin()` check on every action route, on top of the existing SameSite=Lax session cookie.
- **Admin → engine wiring** (the cross-app touch beyond the migration): `BACKUP_ENGINE` service binding + `BACKUP_ENGINE_INTERNAL_TOKEN` secret added to `apps/admin` (same values as web's), plus a minimal engine client (`startRun`/`cancelRun` only) — a slim sibling of `apps/web/src/lib/backup-engine.ts`, extraction into a shared package deferred as a `system-*` follow-up.

## Deferred and why

- **Reset trial / adjust plan / grant credits** — blocked on infrastructure that doesn't exist: the credit schema lives only in the unimplemented [`server-manual-quota-and-credits`](../server-manual-quota-and-credits/) change, there is no Stripe webhook sync (`apps/hooks` is a stub), and `subscription_items` trial rows aren't populated by any current write path. Building these now would entangle this change with the whole billing pipeline.
- **INSERT-only Postgres audit role** (parent 5.1/5.3) — would be the first GRANT/role construct in the repo; deserves its own hardening change. V1 immutability = no update/delete code path + a guard test asserting none exists.
- **24-month retention + R2 archive; audit search UI** (parent 5.2/5.4).
- **Google SSO, staging/prod admin deploy** — unchanged, stay in the umbrella.

## Spec reconciliations (flagged for the parent on archive)

1. **`credit_transactions` vs `credit_ledger`**: parent tasks 4.7 says grant-credits writes `credit_transactions` type `manual_grant`; the credit-model owner (`server-manual-quota-and-credits`) defines `credit_ledger` with `direction='credit'`. Neither table exists yet. Resolution belongs to the credits change; `admin_audit_log.params` (jsonb) is deliberately agnostic so the audit schema won't care which name wins.
2. **Force-migration wording**: parent `design.md` says "triggers the migration script via an admin-only endpoint in `server`" — stale; the only server migrate endpoint is the unrelated per-Space schema upgrade. Parent `tasks.md` 4.8 ("sets `organizations.has_migrated=true`") is authoritative and is what this change implements.
3. **Rate limiting**: the parent spec is qualitative ("every action is rate-limited"). V1 implements the durable audit-table counter described above; revisit thresholds if the staff roster grows.
4. **`triggered_by='admin'`**: new free-text value in `backup_runs.triggered_by`; web's `triggerLabel()` renders unknown values as "Manual" (verified), and the distinct value keeps staff-initiated runs identifiable in both consoles.

## Capabilities

### New Capabilities

- `admin-actions`: append-only `admin_audit_log` (intent/result rows), the `runAudited` write-then-execute helper with durable rate limiting, same-origin CSRF checking, and three audited staff actions (force backup, invalidate connection, force migration completion) with confirmation UI on the existing admin surfaces.

### Modified Capabilities

- `admin-foundation` (behavioral extension, no spec change): the admin app gains its first mutation routes; the middleware gate and per-request DB client are reused unchanged.

## Impact

- **apps/web**: `src/db/schema/core.ts` gains `adminAuditLog`; new migration `drizzle/0025_*.sql`. No web runtime code change.
- **apps/admin**: first writable schema mirror (`admin_audit_log` INSERT, `backup_runs` INSERT/DELETE, `connections`/`organizations` UPDATE — scoped columns only, never `*_enc`); new libs (`audit.ts`, `origin.ts`, `ui.ts`, `backup-engine.ts`, `actions/*`); first API routes; buttons + dialogs on three existing pages; `wrangler.jsonc.example` gains the `BACKUP_ENGINE` service binding; `.dev.vars.example` gains `BACKUP_ENGINE_INTERNAL_TOKEN`.
- **apps/server / apps/workflows**: no change — admin consumes the existing `INTERNAL_TOKEN`-gated `/api/internal/runs/:id/{start,cancel}` contract.
- **Runbooks**: `shared/internal/ops-setup.md` §1 updated (admin env provisioning now includes the binding + token). `oauth-setup.md` was read per CLAUDE.md §3.7 (this change touches the `connections` table); no update needed — no redirect URI, provider, or auth-gating path changes.
- **Security review points**: (1) first mutation surface in admin — gated by the existing `role='super'` middleware, same-origin check, SameSite=Lax cookie; (2) new secret in admin (`BACKUP_ENGINE_INTERNAL_TOKEN`, same value as web's — synced via the `.dev.vars` bulk pipeline, never `wrangler secret put`); (3) audit rows never contain tokens/secrets (`params` carries ids + status codes only); (4) rate limiting is per-actor and durable; (5) no new SQL surface beyond Drizzle parameterized writes.
