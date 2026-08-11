# Design — shared-admin-actions

## Context

`apps/admin` (from `admin-foundation` + `admin-read-surfaces`) is a read-only Astro SSR Worker: middleware gates every request to `users.role='super'` and provides `locals.db` (per-request Drizzle via the shared Hyperdrive) + `locals.user {id,email,role}`. This change adds the audit foundation and the first three mutations. Constraints:

- **Audit before execute** (parent spec): an immutable audit row must exist before any action runs. Append-only means no UPDATE ever — including by our own code.
- **Web owns master-DB migrations**; admin owns none. The audit table's DDL must land in `apps/web/drizzle/`.
- **Don't touch customer/Airtable auth** — admin stays a read-only consumer of sessions; the new mutations act on operational tables only.
- **Workers runtime**: in-memory rate limiters don't survive isolate churn; anything durable must live in Postgres.

## Goals / Non-Goals

**Goals**
- `admin_audit_log` exists, is written intent-first by every action, and accommodates all six eventual actions without schema change.
- Force backup / invalidate connection / force migration work end-to-end from the existing admin surfaces with explicit confirmation.
- Admin can reach the engine (`/runs/:id/start`, `/runs/:id/cancel`) via a service binding, guarded like web's.

**Non-Goals**
- The billing trio, DB-role (GRANT) enforcement, retention/archive, audit search UI, Google SSO, prod deploy — all deferred (see proposal).

## Decisions

### Two-row intent/result audit model

"Write audit before execute" + "append-only, no UPDATE" together rule out an `executed_at`/`status` column that gets written after the fact. Instead each action writes:

1. an **intent** row (`phase='intent'`) before executing — actor snapshot, action, target, params;
2. a **result** row (`phase='result'`, `intent_id` → intent row id) after — `params: {ok, runId?, cancelledRuns?, code?}`.

If the Worker dies mid-action, the result row is simply absent; domain tables (`backup_runs.status`, `connections.status`, `organizations.has_migrated`) remain ground truth. Actor fields are denormalized snapshots (`actor_user_id`, `actor_email`) with **no FK to `users`** — the audit trail must survive user deletion. Db-context defaults (`db_user current_user`, `application_name`, `txid txid_current()`) are copied from the `connection_status_audit` precedent (web migration 0015).

### `runAudited(intent, execute, deps)` — the only door to a mutation

Pure helper (`apps/admin/src/lib/audit.ts`, injected deps, fully unit-tested):

- **Rate guard first**: `countRecentIntentsByActor(actorId, 60_000) >= 10` → `{ok:false, code:'rate_limited'}`, nothing written, `execute` never called. Counting intents *from the audit table itself* makes the limiter durable across isolates and self-documenting.
- **Intent INSERT fails** → `{ok:false, code:'audit_write_failed'}`, `execute` never called (the parent's hard rule).
- **Success path**: intent row → `execute()` → result row. A result-INSERT failure is swallowed (intent + domain state already recorded); an `execute()` throw is recorded as `{ok:false, code:'exception'}` in the result row and surfaced to the route as a failure.

Preconditions (404/409) are checked **before** `runAudited` so precondition rejections don't pollute the audit trail or burn rate-limit budget.

### CSRF: same-origin check + SameSite=Lax

Admin has no better-auth runtime, so no framework CSRF. Defense: (1) the `baseout_admin_session` / `better-auth.session_token` cookies are SameSite=Lax (cross-site POSTs don't carry them); (2) every action route requires `Origin` to equal the request's own origin (`checkOrigin` in `src/lib/origin.ts` — missing Origin rejected; all modern browsers send it on POST). Mirrors better-auth's `trustedOrigins` idea in ~10 testable lines.

### Engine access: minimal client + service binding

Web's `backup-engine.ts` is a ~600-line multi-purpose client; admin needs exactly two calls. A slim `apps/admin/src/lib/backup-engine.ts` exposes `startRun(runId)` / `cancelRun(runId)` against `binding.fetch('https://engine/api/internal/runs/…', {headers:{'x-internal-token': …}})`, with web's null-guard behavior (missing binding/token → `server_misconfigured` 503 for force-backup; invalidate-connection degrades gracefully — the status flip still lands, cancels are reported `skipped_no_engine`). Extracting a shared engine-client package is a `system-*` follow-up, out of scope per CLAUDE.md §3.2.

### Action semantics

- **Force backup** replicates web's `startBackupRun` contract (`apps/web/src/lib/backup-runs/start.ts`) minus the per-org IDOR check (staff is cross-org by definition; the `role='super'` gate is the authorization): space → active Airtable connection → ≥1 included base → INSERT run (`queued`, `triggered_by='admin'`, `is_trial=false`) → engine start → DELETE orphan run row on engine 4xx. Note: this path never had quota checks (web-side quota gating is a future credits-change concern) — an admin force-backup deliberately bypasses customer quotas; the audit row is the accountability mechanism.
- **Invalidate connection**: 409 if already `invalid`; UPDATE `status='invalid', invalidated_at=now(), modified_at=now()`; then enumerate `queued|running` runs on that connection and `cancelRun` each, collecting per-run outcomes into the result row. Cancel failures never roll back the flip. Customer-visible effect: web's connection-health banner shows "broken" + reconnect CTA, and new backups are refused — exactly the operator intent.
- **Force migration**: 409 if `has_migrated` already true; UPDATE `organizations.has_migrated=true`. `dynamic_locked` is left untouched — it encodes the org's On2Air pricing lock, a separate concern from migration completion.

### UI: inline daisyUI dialog, no component library

Three buttons don't justify porting `Modal.astro`/`ConfirmModal.astro` + Storybook into admin (which has no components dir). Each page gets one native `<dialog class="modal">` reused via data-attributes, plus a small `src/lib/ui.ts` porting web's `setButtonLoading` (spinner-on-wait discipline, web CLAUDE.md §12) and a `postAction(path, body, btn)` fetch wrapper. Componentization is the flagged follow-up when a fourth action lands.

## Risks / Trade-offs

- **App-layer append-only is weaker than a DB role.** Accepted for V1: the guard test asserts no update/delete call site exists; the GRANT-based role is parent 5.1 and would be the repo's first role construct.
- **Result rows can be lost on Worker death.** Accepted: intent row + domain tables reconstruct the story; treating absent-result as "outcome unknown" is honest.
- **Admin holds the engine internal token.** Same trust level as web already has; synced via the existing `.dev.vars` bulk pipeline (never `wrangler secret put` — encryption-drift rule).
- **Rate limit is coarse** (per-actor, all actions pooled). Fine for a single-digit staff roster; revisit in the umbrella.

## Migration Plan

1. Land schema + migration 0025 in web; `pnpm --filter @baseout/web db:migrate` against dev before any admin smoke (web CLAUDE.md §5.5).
2. Land admin libs/routes/UI (no deploy dependency — local dev works once migrated).
3. Add binding + token to `apps/admin/wrangler.jsonc.example` / `.dev.vars.example`; redeploy `baseout-admin-dev` via the standard deploy script when dev-deployed smoke is wanted.

## Open Questions

- None blocking. Threshold tuning for the rate guard and the audit-search surface are parent-umbrella concerns.
