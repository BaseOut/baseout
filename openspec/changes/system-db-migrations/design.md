# system-db-migrations — Design

## D1. Where the migration runs in CI

The question is not *whether* CI can reach the database — `db/migrations/test/migrate.js`
already proves the `cloudflared access tcp` + service-token path works. It is **which
pipeline owns the run**, and the answer changes the failure modes more than the mechanics.

### Option A — a step in `apps/web`'s Workers Builds build command

```
pnpm db:migrate:tunnel && CLOUDFLARE_ENV=$ENV pnpm --filter @baseout/web build
```

**Pros**
- No new infrastructure. One build-command edit, one set of build secrets.
- `apps/web` already owns master-DB migrations, so ownership matches the existing rule.
- A failed migration fails the build, so **the app most coupled to the schema does not
  deploy against a database it does not match**. This is the strongest property on offer.
- One place to look when a migration fails.

**Cons**
- Runs on every `apps/web` push, including doc-only ones. Harmless (drizzle no-ops in
  ~1s) but noisy, and it means DB credentials are exercised far more often than needed.
- **A migration pushed without touching `apps/web` does not trigger anything** unless
  web's build watch paths are widened to include `db/migrations/**`. Easy to get right,
  easy to forget, and silent when wrong.
- Couples migration timing to web's build health: a Storybook coverage failure blocks a
  migration that has nothing to do with it.
- DB DDL credentials + the Zero Trust service token live in an app build environment
  alongside 16 unrelated runtime secrets.

### Option B — a standalone "migrator" Worker watching `db/migrations/**`

**Pros**
- Runs only when migrations actually change (build watch paths), so no wasted runs.
- Credentials isolated to one build environment that has no other purpose.
- Independent of any app's build health; unambiguous logs and failure attribution.
- Re-runnable on its own without redeploying an app.

**Cons**
- **The Worker is a fiction.** Workers Builds attaches a pipeline to a *deployable Worker*,
  so this requires deploying a no-op Worker whose only purpose is to own a build config —
  consuming a script name and a subdomain in both accounts, and inviting the question
  "what does `baseout-migrator` serve?" forever after.
- It is Workers Builds used as a generic CI runner, which it is not designed to be. The
  deploy command would be the migration; the "deploy" deploys nothing.
- **It does not buy ordering.** Two independent pipelines triggered by one commit still
  race — arguably worse than A, because A at least orders the migration ahead of *web's*
  deploy. Nothing sequences the migrator against the seven other app builds.
- More provisioning: a Worker, a build config, and secrets, in each of two accounts.

### Option C — a GitHub Actions job triggered on `db/migrations/**`

```yaml
on: { push: { paths: ['db/migrations/**'] } }
concurrency: { group: db-migrate-${{ github.ref }}, cancel-in-progress: false }
```

**Pros**
- Every benefit of B (path-triggered, isolated credentials, independent, clear logs)
  **without a fictional Worker.** Path-filtered triggers are what this tool is for.
- Native `concurrency` groups prevent two migration runs overlapping at the platform
  level, on top of the advisory lock.
- GitHub Actions is **already in the stack** — `apps/workflows` must deploy through it
  because Workers Builds can only run wrangler. This adds a job, not a system.
- The only path that can ever give true ordering: if migrations must strictly precede
  deploys, GHA can own both (migrate, then `wrangler deploy` per app) and Workers Builds
  auto-deploy gets disabled. That is a bigger change, but this option is the on-ramp.

**Cons**
- Two CI systems remain in play for Cloudflare-adjacent work, which is the thing the
  Workers Builds standardisation was meant to reduce.
- Still races with Workers Builds deploys triggered by the same push (until/unless deploys
  move to GHA too).
- A second place to store the Zero Trust service token.

### Decision

**Option A now; Option C when ordering becomes a real constraint.**

Rationale: A's decisive property is that the schema-coupled app cannot deploy ahead of its
migration, and it costs one line. B is C with extra weirdness — it buys nothing A or C
doesn't, and leaves a no-op Worker in two accounts as permanent explanation debt.

The trigger for revisiting is concrete: **the first time a migration must land before a
non-web Worker deploys.** At that point expand-then-contract is no longer sufficient, and
the answer is C with deploys moved under GHA — not B.

Required alongside A:
- `apps/web` build watch paths **must** include `db/migrations/**`, `db/**`, and
  `pnpm-lock.yaml`, or a migration-only push deploys nothing and applies nothing.
- The advisory lock is not optional. A protects against the *expected* concurrency, not
  against a manual run or a re-run of a stuck build.

## D2. Tunnel-optional, not tunnel-always

`migrate.mjs` spawns `cloudflared` only when `TUNNEL=1`. The dev database is directly
reachable and a tunnel there would add a Zero Trust dependency to every local
`pnpm db:migrate` for no benefit. Local and dev use the direct path; staging and production
use the tunnel. The connection target is otherwise identical, so the two paths differ by
host/port only.

## D3. Advisory lock, not table locking

```js
await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])
try { /* drizzle-kit migrate */ } finally { await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]) }
```

Session-scoped advisory lock on a constant key. Chosen over `LOCK TABLE` because it does not
require a transaction wrapping the whole migration run (drizzle-kit manages its own
transactions per migration) and because it releases automatically if the connection dies —
a killed CI job cannot leave the lock held.

`__drizzle_migrations` is a ledger of what has been applied, not a mutex; two runners can
both read "39 applied" and both try to apply 40.

## D4. Why not a Worker endpoint or a Trigger.dev task

Considered and rejected:

- **Migration endpoint on `apps/server` via Hyperdrive** — removes the tunnel entirely,
  since the engine already has DB access. Rejected: Worker CPU/wall limits will kill a
  long-running DDL (a table rewrite on `backup_runs`) mid-migration, and recovering from a
  half-applied migration with no local artifacts is materially worse than any problem this
  solves.
- **A Trigger.dev `migrate` task** — Node runner, no time limit, already per-environment.
  Genuinely viable, and worth reconsidering if the tunnel proves fragile in the build
  container. Rejected for now because it puts schema changes behind a *second* deploy
  pipeline (the task itself must be deployed before it can migrate), which inverts the
  dependency in a confusing way.

## D5. Expand-then-contract is a rule, not advice

Because no option guarantees migration-before-deploy across all eight Workers, the schema
change itself must tolerate running against both the old and new code for a window:

1. **Expand** — add columns/tables as nullable or defaulted. Ships in release *n*.
2. **Migrate data + switch reads/writes.** Release *n* or *n+1*.
3. **Contract** — drop the old column. Ships no earlier than *n+1*, after every Worker is
   known to be on the new code.

A single change that adds a `NOT NULL` column without a default, or drops a column still
read by a deployed Worker, will break production regardless of which CI option is chosen.
This is recorded in root `CLAUDE.md` §3.9 rather than left to reviewer memory.
