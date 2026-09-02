# Design — shared-org-runtime-env

## Context

Dan confirmed one Postgres for local/dev and staging. Encryption keys will differ per Worker env. Canonical name is **Organization** (Features §1), not account. Field: `runtime_env`.

## Decisions

1. **Column on `organizations` only.** Spaces and Connections are reached through `organization_id`.
2. **Backfill `staging`.** Existing rows are the console dataset. Local will see no orgs until a new Organization is created (tagged `dev`).
3. ~~**Login = filter memberships**, not reject the session (Autumn, 2026-09-01).~~
   **REVISED 2026-09-01 (Dan's explicit ask: "only allow login to accounts in
   same env"): login is env-GATED, not just filtered.** `users.runtime_env`
   (migration 0041, same shape as 0040) is stamped at user creation with the
   Worker's env. Enforcement at two layers: (a) magic-link REQUEST — an
   existing user whose `runtime_env` ≠ worker env gets the same neutral
   "check your email" response but no link is sent (no account-env oracle);
   (b) session middleware — a session whose user's env mismatches is treated
   as unauthenticated (defense-in-depth for sessions minted before the gate).
   ~~Consequence: one email = one env (users.email is unique). Team members
   needing both envs use plus-aliases (e.g. `autumn+dev@openside.com`).~~
   **AMENDED same day (Autumn: "we would be using our standard email across
   the env"): internal emails are EXEMPT from the login gate.** Both layers
   (magic-link request + session middleware) bypass the `runtime_env` check
   when `isInternalEmail(user.email)` is true (the existing
   `capabilities/internal-access` helper — do not invent a second list).
   External/customer accounts stay env-locked exactly per Dan's rule; staff
   log into every env with their standard address, and per-env isolation of
   staff data still holds via `organizations.runtime_env` (each env resolves
   only its own orgs; onboarding creates a same-env org). Without this
   exemption the 0041 backfill ('staging') locks staff out of local dev
   entirely — the gate refuses before even the dev terminal-log branch.
   The membership filter from the original decision stays as belt-and-braces.

   **SECOND AMENDMENT (Dan, 2026-09-01 17:30, implemented 2026-09-02): no
   user-level gate, no exemptions — uniqueness becomes per-env.** The same
   email exists as a SEPARATE user row per environment:
   `unique(users.email, users.runtime_env)` (migration 0042 swaps the old
   `users_email_unique`). `users.runtime_env` stays as the materialized
   carrier of the account-side env (a cross-table unique isn't expressible in
   Postgres): stamped from the worker env at creation, never independently
   settable. Every email-addressed `user` query better-auth makes is scoped
   to the worker env at the adapter boundary (`auth-env-scope.ts`, wrapping
   the adapter exactly like the two-factor encryption hook) — an other-env
   user simply does not resolve, so login gating is implicit: request a link
   on dev and you either get YOUR dev user or a fresh one is created. The
   explicit magic-link refusal gate and the internal-email exemption are both
   REMOVED (5.15 reverted); `sessionMatchesWorkerEnv` stays as pure
   defense-in-depth. Domain-association (welcome offers, join requests) is
   env-filtered so cross-env memberships cannot form. Consequences accepted:
   per-env 2FA enrollment, per-env `role='super'`, per-env preferences.
4. **Resolve env** from `BASEOUT_ENV` if it is `dev|staging|production`; else `BASEOUT_DEV=true` → `dev`; else `null` (fail closed).
5. **Fail closed on mismatch** at run-start (`env_mismatch` → 403) so a queued staging run cannot be started by a local engine.
6. **Onboarding resume** joins owner membership to `runtime_env = current`. A staging owner-org does not resume on local.

## Engine

Mirror `organizations (id, runtime_env)` on `apps/server`. Refresh sweep and keepalive `innerJoin` that table. `processRunStart` gains `assertOrganizationRuntimeEnv(organizationId)` using `resolveRuntimeEnv(env)`.

## Migration

Additive: `NOT NULL DEFAULT 'staging'` plus a CHECK constraint. Snapshot + journal `0040`. Apply on the shared cluster before relying on split keys.

## Added decisions (2026-09-01 completion pass)

7. **🔴 Production backfill is a landmine and gets an explicit gate.** The one
   migration lineage also runs on the SEPARATE production DB; `DEFAULT
   'staging'` would tag every real production Organization/user `staging` and
   the production worker would filter them all out (total prod lockout).
   Before this change is ever merged toward `main`: document in
   `shared/internal/ops-setup.md` (prod section) the required one-off run on
   the prod DB immediately after 0040/0041 apply there —
   `UPDATE baseout.organizations SET runtime_env='production'; UPDATE
   baseout.users SET runtime_env='production';` — and add a runtime tripwire:
   the production worker logs a loud structured error when it resolves
   `production` but finds zero production-tagged organizations while the
   table is non-empty.
8. **Every cron job that reads shared rows filters by env.** Two workers now
   fire identical crons against one DB. Beyond the already-filtered
   oauth-refresh-sweep/keepalive: `run-reconciliation` (else the dev worker
   fails staging's stuck runs against the wrong Trigger.dev env),
   `webhook-renewal` (decrypts tokens), `connection-auto-invalidate`
   (cross-env status writes), `report-schedule-sweep` (double-sent customer
   reports). `service-runs-prune` stays unfiltered by design (telemetry
   prune is idempotent and env-agnostic — note it in code).
9. **One env gate for every engine work entrypoint.** `assertOrganizationRuntimeEnv`
   extends beyond backup run-start to: restore-start, incremental-backup,
   health-score, chat-respond, render-report, delete-run-files — and the
   ConnectionDO `/token` path plus whoami/test-connection refuse to decrypt a
   Connection whose Organization env mismatches (`refresh_env_mismatch`).
   Prefer wiring the check once per deps-builder rather than per-route
   copy-paste where the existing structure allows.
10. **Web write-path sweep.** Any route that accepts an org/space id and
    checks membership only (org switcher, spaces, connections CRUD) must also
    check the org's `runtime_env` — one shared guard in the org-resolution
    helper, not ad-hoc per route. Otherwise a dev Connect flow can write
    dev-key-encrypted tokens onto rows the staging worker later reads.
11. **`BASEOUT_ENV` everywhere.** api/hooks/sql/admin env blocks get the var
    for future use; only web+server enforce in this change (admin staff
    surfaces deliberately see all envs — unchanged).
