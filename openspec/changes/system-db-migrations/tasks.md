# system-db-migrations — Tasks

## 0. Prerequisites

- [x] 0.1 ~~Unblock `pnpm install`~~ **RESOLVED UPSTREAM 2026-08-30, no change needed.**
  `@colordx/core`'s registry metadata now carries a `time` field (56 entries); when this
  was written it did not. Pinned 5.5.0 is 66 days old, 5.6.0 is 8 — both past the 7-day
  gate. `pnpm install --frozen-lockfile` (the CI path) passes. **No `minimumReleaseAgeExclude`
  entry was added** — that would permanently opt the package out of the supply-chain gate
  for a transient upstream bug. If it recurs, the two existing entries show the pattern.
  ~~in `pnpm-workspace.yaml`~~ (transitive of `mjml@5.4.0` in `apps/support`; currently fails
  `ERR_PNPM_MISSING_TIME`). **Every Workers Build does a clean install — nothing in this
  change can run until this passes.** Verify: `pnpm install --frozen-lockfile` exits 0.
- [x] 0.2 Confirm the `cloudflared` npm package installs under the same policy; add to the
  exclude list if its metadata lacks a `time` field.

## 1. Move the migration lineage

- [x] 1.1 `git mv apps/web/drizzle db/migrations` — all 40 `.sql` files **and** `meta/`.
  Verbatim; no renaming, no re-baselining. Drizzle hashes contents, not paths, so
  `drizzle.__drizzle_migrations` stays valid.
- [x] 1.2 `git mv apps/web/drizzle.config.ts db/drizzle.config.ts`; repoint `out` to
  `./migrations` and the five `schema` entries to `../apps/web/src/db/schema/*.ts`.
  **Carry the `DATABASE_URL`-decomposition + `ssl: { rejectUnauthorized: false }` block and
  its comment across unchanged** — dropping it reproduces the 2026-07-27 silent failure
  (drizzle-kit exits 1 with zero output).
- [x] 1.3 Move `apps/web/scripts/check-migrations.mjs` → `db/check-migrations.mjs`;
  repoint `JOURNAL_PATH` at `db/migrations/meta/_journal.json`.
- [ ] 1.4 Verify against the dev DB before touching anything else:
  `pnpm db:check` reports in-sync, and `pnpm db:migrate` is a no-op that applies 0
  migrations. A non-zero apply count here means the journal/tracker relationship broke.

## 2. The runner

- [ ] 2.1 Promote `db/migrations/test/migrate.js` → `db/migrate.mjs` (ESM). Keep the
  env-var preflight and the `waitForPort` loop as-is; they are proven.
- [ ] 2.2 Make the tunnel conditional on `TUNNEL=1` (design D2). Without it, connect
  directly from `DATABASE_URL`.
- [ ] 2.3 Replace the `SELECT 1 + 1` sanity query with `drizzle-kit migrate --config db/drizzle.config.ts`.
- [ ] 2.4 Wrap the run in `pg_advisory_lock` / `pg_advisory_unlock` on a constant key
  (design D3).
- [ ] 2.5 Move teardown into `finally` — `tunnelProcess.kill()` currently runs only on the
  success path and one catch; a throw between them leaks the process and the CI step hangs.
- [ ] 2.6 `db/package.json`: `cloudflared`, `drizzle-kit`, `pg`. Delete `db/migrations/test/`.
- [x] 2.7 Root `package.json`: `db:generate`, `db:migrate`, `db:migrate:tunnel`, `db:check`.
- [x] 2.8 `apps/web/package.json`: keep `db:migrate` / `db:check` as aliases to the root
  scripts so existing docs and muscle memory keep working.

## 3. Rules and pointers

- [x] 3.1 Root `CLAUDE.md` §2 repo layout: add `db/` with a one-line description.
- [x] 3.2 Root `CLAUDE.md`: new **§3.9 Master-DB Migrations** — location, the one-runner
  rule, and expand-then-contract (design D5) stated as a requirement.
- [x] 3.3 `apps/web/.claude/CLAUDE.md` §5.5: repoint at `db/migrations/`; keep the
  "migrate before the code that reads the column ships" rule intact.
- [x] 3.4 Update the ~12 `// Migration: apps/web/drizzle/...` header comments in
  `apps/server/src/db/schema/*.ts` and `apps/hooks/src/db.ts`. **Comments only — no code.**
  Do NOT rewrite `openspec/changes/**`: those archived docs correctly describe where the
  files were at the time.
- [ ] 3.5 `architecture/systems-overview.md` §6: note the new location and CI runner.

## 4. CI wiring (design D1, Option A)

- [ ] 4.1 `apps/web` Workers Builds build command:
  `pnpm db:migrate:tunnel && CLOUDFLARE_ENV=$ENV pnpm --filter @baseout/web build`
- [ ] 4.2 `apps/web` build watch paths **must** include `db/**` and `pnpm-lock.yaml`
  alongside `apps/web/**` and `packages/**`. Without `db/**`, a migration-only push
  triggers no build and applies nothing — silently.
- [ ] 4.3 Post-run assertion in `migrate.mjs`: after applying, compare
  `meta/_journal.json` entry count against `drizzle.__drizzle_migrations` row count and
  exit non-zero on mismatch. Guards the silent-no-op failure mode.
- [ ] 4.4 Build secrets, per account: `DB_TUNNEL_HOSTNAME`, `DB_USER`, `DB_PASSWORD`,
  `DB_NAME`, `CF_CLIENT_ID`, `CF_CLIENT_SECRET`. **Build**-phase, not runtime.
- [ ] 4.5 Zero Trust: a service token + tunnel hostname per account (staging, production).
  Grant the token only the DB application in the Access policy.

## 5. Verification

- [ ] 5.1 Local, no tunnel: `pnpm db:migrate` against dev applies pending migrations and
  `pnpm db:check` goes clean.
- [ ] 5.2 Tunnel path, run manually before trusting CI:
  `TUNNEL=1 pnpm db:migrate` from a laptop with the staging service token.
- [ ] 5.3 Concurrency: run two `TUNNEL=1 pnpm db:migrate` simultaneously; the second must
  **block on the advisory lock and then no-op**, not error and not double-apply.
- [ ] 5.4 Failure path: point `DB_PASSWORD` at a wrong value; confirm the build fails, the
  `cloudflared` process is reaped, and no partial state is left.
- [ ] 5.5 End-to-end: push a trivial additive migration, confirm Workers Builds applies it
  and `apps/web` deploys after — in that order, in the build log.

## 6. Follow-ups (not this change)

- [ ] 6.1 Revisit design D1 if a migration must land before a **non-web** Worker deploys —
  that is the trigger for Option C (GitHub Actions owning migrate + deploys).
- [ ] 6.2 `packages/db-schema` still holds an unused `migrations/` dir and `drizzle.config.ts`
  from the stalled extraction. Decide whether that package absorbs the master schema or the
  scaffolding is deleted.
