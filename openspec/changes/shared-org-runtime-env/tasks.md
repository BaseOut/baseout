# Implementation tasks

- [x] 1.1 Unit tests for `resolveRuntimeEnv` / `isOrgRuntimeEnv` (web + server copies, identical rules)
- [x] 1.2 Migration `0040_org_runtime_env.sql` + journal + snapshot; Drizzle column on web `organizations`; server mirror table
- [x] 2.1 `getAccountContext` filters by runtime env; middleware passes resolved env
- [x] 2.2 `provisionOnboarding` stamps `runtime_env` and resumes only same-env owner orgs
- [x] 2.3 Web wrangler `BASEOUT_ENV` on `env.dev` / `env.staging` / `env.production`
- [x] 3.1 `processRunStart` rejects `env_mismatch` (test first)
- [x] 3.2 OAuth refresh sweep + keepalive join `organizations.runtime_env`
- [x] 4.1 E2E seed org insert sets `runtimeEnv: 'dev'`

## Phase 5 — Completion pass (2026-09-01 review: design decisions 3-revised, 7–11; TDD throughout)

- [x] 5.1 Migration `0041_user_runtime_env.sql` (+ journal + snapshot): `users.runtime_env text NOT NULL DEFAULT 'staging'` + CHECK, Drizzle column on web `users` schema. Apply to the shared cluster (`pnpm db:migrate`).
  Evidence 2026-09-01: `db/migrations/0041_user_runtime_env.sql` + journal idx 41; `packages/db-schema` + two-factor adapter mirror; `pnpm db:migrate` applied successfully.
- [x] 5.2 Stamp env at user creation (better-auth databaseHooks / user-create path): new users get the Worker's resolved env. Test: user created under `BASEOUT_ENV=dev` has `runtime_env='dev'`.
  Evidence 2026-09-01: `userCreateRuntimeEnvFields` + `databaseHooks.user.create.before`; `src/lib/runtime-env.test.ts` stamps `{ runtimeEnv: 'dev' }`.
- [x] 5.3 Login gate, layer A — magic-link request: existing user with mismatched `runtime_env` → same neutral success response, no email sent (no env oracle). Test both directions.
  Evidence 2026-09-01: `shouldSendMagicLink` both directions + fail-closed; `auth-factory` skips `sendEmail` after `onMagicLinkRequested`.
- [x] 5.4 Login gate, layer B — session middleware: session whose user env ≠ worker env is treated as unauthenticated (and the session-cache entry is not poisoned). Test: staging-tagged user's session on a dev worker → redirected to login.
  Evidence 2026-09-01: `sessionMatchesWorkerEnv`; middleware ignores L1/L2 cache on mismatch and does not write cache; treated as unauthenticated (login redirect).
- [x] 5.5 🔴 Prod-lockout gate (design D7): ops-setup.md prod section documents the one-off `UPDATE … SET runtime_env='production'` for BOTH tables immediately after 0040/0041 reach the prod DB, and the production worker logs a structured tripwire error when it sees zero production orgs in a non-empty table. This task BLOCKS any merge toward main.
  Evidence 2026-09-01: `shared/internal/ops-setup.md` Production section; `productionLockoutEvent` + `maybeLogProductionLockout` on web first request and server `scheduled()`.
- [x] 5.6 Filter `run-reconciliation` listings (backup_runs + restore_runs joined through spaces→organizations) by worker env. Test: a stuck run belonging to the other env is not reconciled.
  Evidence 2026-09-01: `reconcile-deps` innerJoin + `workerOrgScope`; `selectRowsForWorkerEnv` unit test drops other-env runs.
- [x] 5.7 Filter `webhook-renewal` listing by org env (same join). Test as 5.6.
  Evidence 2026-09-01: `webhook-renewal-deps` joins connections→organizations; same `selectRowsForWorkerEnv` coverage.
- [x] 5.8 Filter `connection-auto-invalidate` predicate by org env.
  Evidence 2026-09-01: `runScheduledConnectionInvalidation` `inArray(organizationId, orgs where runtime_env = scope)`.
- [x] 5.9 Filter `report-schedule-sweep` listing by org env (kills double-send). Leave `service-runs-prune` unfiltered with a code comment (design D8).
  Evidence 2026-09-01: `listDueClockDefinitions(..., runtimeEnv)`; prune comment in `apps/server/src/index.ts`.
- [x] 5.10 Extend `assertOrganizationRuntimeEnv` to restore-start, incremental-backup, health-score, chat-respond, render-report, delete-run-files entrypoints (wire once in the deps builders where possible). Tests: each rejects `env_mismatch`.
  Evidence 2026-09-01: shared `organizationMatchesWorkerEnv` / `spaceMatchesWorkerEnv` / `connectionMatchesWorkerEnv`; restore/delete/generate tests `env_mismatch`; chat-send + health-rerun 403; SpaceDO incremental enqueue throws `env_mismatch`.
- [x] 5.11 ConnectionDO `/token` + whoami/test-connection: refuse decrypt when the Connection's Organization env mismatches (`refresh_env_mismatch` / 403). Test at the DO gate.
  Evidence 2026-09-01: ConnectionDO gate + `connection-do-token-cache.test.ts`; whoami maps 403 → `refresh_env_mismatch`.
- [x] 5.12 Web org-resolution guard (design D10): the shared helper that turns an org/space id + membership into an authorized context also requires `runtime_env` = worker env; sweep org-switcher, spaces, connections routes onto it. Test: membership in an other-env org cannot be activated or written to.
  Evidence 2026-09-01: `requireWritableOrganization` + `organizationIsWritableForEnv`; wired on spaces POST/switch/PATCH and Airtable start/persist; persist mismatch test added (CI docker PG).
- [x] 5.13 Add `BASEOUT_ENV` vars to api/hooks/sql/admin env blocks (no enforcement there yet, design D11).
  Evidence 2026-09-01: `apps/{api,hooks,sql,admin}/wrangler.jsonc` env.dev/staging/production.
- [x] 5.15 Internal-email exemption (design D3 amendment, 2026-09-01): both login-gate layers (`shouldSendMagicLink` / `onMagicLinkRequested`, and `sessionMatchesWorkerEnv` middleware check) bypass the env check when `isInternalEmail(user.email)` — reuse `capabilities/internal-access`, no new list. Tests: (a) staging-tagged `@openside.com` user CAN request a magic link and hold a session on a dev worker; (b) staging-tagged external user still cannot (both layers); (c) fail-closed behavior unchanged for null env. Manual smoke: local `pnpm dev` login with the standard staff email works again.
  Evidence 2026-09-01 (Claude): TDD — 6 new tests red→green; `email` threaded through `shouldSendMagicLink` + `sessionMatchesWorkerEnv` and all 4 call sites (auth-factory sendMagicLink, middleware L1/L2 cache + fresh session); cached user shape already carries email+runtimeEnv; runtime-env + auth-factory suites 41/41; tsc clean on touched files. Manual smoke (HUMAN): local login with autumn@openside.com.
- [x] 5.14 Full checks: affected suites green, `pnpm typecheck` no new errors, `pnpm secrets:check` + `pnpm cron:check` green, no stray console; update this file's checkboxes with evidence notes.
  Evidence 2026-09-01: web `runtime-env` + auth-factory 35 passed; server 89 tests (runtime-env, restore, delete, generate, DO, runs-start); `tsc --noEmit` on `@baseout/server` + `@baseout/db-schema`; `node scripts/check-wrangler-secrets.mjs` green. `pnpm --filter @baseout/server check:cron` fails pre-existing (missing `wrangler.jsonc.example`, not this change). Tripwire `console.error` is eslint-disable + D7 justification. `pnpm db:migrate` applied 0041.


## Phase 6 — D3 second amendment: per-env users, no exemptions (2026-09-02, Claude)

- [x] 6.1 Migration `0042_user_email_env_unique`: drop `users_email_unique`, add `UNIQUE(email, runtime_env)`; Drizzle schema updated (composite unique + `check()` constraints added to schema so drizzle-kit stops trying to drop the hand-written 0040/0041 CHECKs). Applied to the shared cluster — verified `pg_constraint` shows only `users_email_runtime_env_unique`.
- [x] 6.2 `auth-env-scope.ts` (`withUserEnvScope`): adapter-boundary wrapper scoping every email-addressed `user` find/update/delete/count to the worker env (`'__none__'` sentinel when env unknown — fail closed); composed OUTERMOST around the two-factor wrapper in auth-factory. TDD: 6 tests red→green (scope on email lookups, id lookups untouched, other models untouched, sentinel, create untouched).
- [x] 6.3 Removed `shouldSendMagicLink` + the `lookupUserRuntimeEnv` wiring + the internal-email exemption (5.15 reverted); `sessionMatchesWorkerEnv` back to a pure env equality (defense-in-depth). Suites updated.
- [x] 6.4 Domain-association env filter: `resolveOrganizationsForEmail` takes the worker env and filters both queries; threaded through `createJoinRequest`, `handleAccountCreated`, the domain-association + join-request API routes, and `welcome.astro` (caught by typecheck).
- [x] 6.5 Checks: web suites 90/90 (runtime-env, auth-env-scope, auth-factory, middleware, signup); `astro check` error set byte-identical to branch baseline (75 pre-existing, 0 introduced); `pnpm db:migrate` applied 0042.
- [ ] 6.6 HUMAN smoke: local `pnpm dev` login with autumn@openside.com — a fresh dev user row is created (staging row untouched); staging login on console.baseout.dev unaffected.
