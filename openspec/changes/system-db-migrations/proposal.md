# system-db-migrations

## Why

Master-DB migrations live in `apps/web/drizzle/` and are applied by a human running
`pnpm --filter @baseout/web db:migrate` from a laptop. Three things make that untenable now:

- **Deploys move to Cloudflare CI.** Workers Builds deploys on push, from Cloudflare's
  build container. Nobody deploys from a workstation any more, so nobody is positioned to
  run the migration that a deploy depends on. The gap between "code that reads a column"
  and "column exists" becomes a race nobody is watching.
- **The database will not be publicly reachable.** Production Postgres sits behind
  DigitalOcean trusted-sources, and the Workers VPC path cannot verify DO's private CA
  (see `architecture/systems-overview.md` §9). A CI runner needs a Cloudflare Zero Trust
  tunnel to reach it at all. `db/migrations/test/migrate.js` already proves this works:
  the `cloudflared` npm package spawns `cloudflared access tcp` with a service token, and
  a normal `pg` client connects over the loopback port.
- **The location no longer matches the ownership.** `apps/web/drizzle/` is read by four
  apps (`server`, `hooks`, `api`, `sql` all mirror tables from it) but sits inside one
  app's directory, and twelve schema files in `apps/server/src/db/schema/` carry
  `// Migration: apps/web/drizzle/00XX_*.sql` header comments pointing across an app
  boundary. The master DB is shared infrastructure, not a web concern.

The failure mode this prevents is specific and already documented: a `SELECT` against a
not-yet-migrated column renders an opaque 404/500 with no useful error
(`apps/web/.claude/CLAUDE.md` §5.5). A silent one has shipped before — on 2026-07-27
`drizzle-kit migrate` exited 1 with **zero output** because pg@8.22 treats `sslmode=require`
as verify-full and rejects DO's chain. That workaround must survive this move.

## What Changes

- **Move `apps/web/drizzle/` → `db/migrations/`** — 40 `.sql` files plus `meta/_journal.json`,
  moved verbatim. Drizzle hashes file *contents*, not paths, so the existing journal and the
  `drizzle.__drizzle_migrations` tracking table stay valid; no re-baselining.
- **Move `apps/web/drizzle.config.ts` → `db/drizzle.config.ts`**, repointing `out` and the
  `schema` globs. The `DATABASE_URL`-decomposition + `ssl: { rejectUnauthorized: false }`
  workaround is carried across unchanged, with its comment.
- **Promote `db/migrations/test/migrate.js` into `db/migrate.mjs`** — the proven tunnel
  bootstrap, extended with: tunnel-optional mode (`TUNNEL=1`; the dev DB is directly
  reachable and should not pay for a tunnel), a Postgres advisory lock around the run,
  `drizzle-kit migrate` in place of the `SELECT 1+1` sanity query, and teardown in a
  `finally` so a failed migration cannot leak the `cloudflared` process.
- **Root `package.json` scripts** — `db:generate`, `db:migrate`, `db:migrate:tunnel`,
  `db:check` become repo-level, not `--filter @baseout/web`.
- **CI wiring** — one designated runner applies migrations on push. Option chosen in
  `design.md` D1.
- **Rules updated** so the new location is the remembered one: root `CLAUDE.md` §2 (repo
  layout) and a new §3.9, plus `apps/web/.claude/CLAUDE.md` §5.5.
- **Comment pointers updated** in the ~12 mirrored-schema files that name
  `apps/web/drizzle/...` as the canonical source.

**Explicitly out of scope: per-Space schemas.** `packages/db-schema/drizzle.space-pg.config.ts`
and `drizzle.space-sqlite.config.ts` generate DDL applied at Space-provision time by
application code, not by `drizzle-kit migrate` against one database. They stay where they
are and must not be wired into this runner.

## Capabilities

### New Capabilities

- **Automated master-DB migration on deploy.** Pushing a migration applies it, without a
  human running a command against production.
- **CI database reachability.** A Zero Trust service token + `cloudflared access tcp` gives
  the build container a path to a database with no public ingress.
- **Concurrency safety.** A `pg_advisory_lock` makes a second concurrent runner wait rather
  than double-apply — Drizzle's `__drizzle_migrations` table is a ledger, not a lock.

### Modified Capabilities

- `pnpm db:migrate` moves from app-scoped to repo-scoped. The local developer flow is
  otherwise unchanged: still `drizzle-kit`, still the same journal, still `db:check`
  gating `pnpm dev`.

### Removed Capabilities

None. `apps/web`'s `db:migrate` / `db:check` scripts become thin aliases to the root ones
so existing muscle memory and docs keep working.

## Risks

- **No cross-Worker ordering.** Workers Builds fires all eight app builds in parallel on a
  push. A migration cannot be guaranteed to land before `apps/server` deploys. Mitigation is
  process, not code: **expand-then-contract** — additive migrations ship in release *n*,
  destructive ones in *n+1*. Recorded as a rule, not an aspiration.
- **A silent no-op is worse than a failure.** If the SSL workaround is dropped in the move,
  CI shows a green migrate step that migrated nothing. Task 4.3 asserts the journal count
  against `__drizzle_migrations` after every CI run for exactly this reason.
- **Blocked on `pnpm install`.** Every Workers Build does a clean install, which currently
  fails with `ERR_PNPM_MISSING_TIME` on `@colordx/core` (a transitive of `mjml@5.4.0` in
  `apps/support`) under the `minimumReleaseAge` policy. Prerequisite, tracked in task 0.1.
- **Two accounts, two tunnels.** Zero Trust service tokens and tunnel hostnames are
  account-scoped; staging and production each need their own set.
