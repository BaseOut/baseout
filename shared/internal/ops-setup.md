# Ops Setup Checklist — Staging + Production

Bootstrap the `feature → staging → main → prod` pipeline. This is one-time work
(per-environment) performed outside the repo, in the Cloudflare dashboard,
DigitalOcean, GitHub repo settings, and Stripe.

Owner: the engineer provisioning the environment.

> **⚠ Re-based 2026-09-01 (`system-staging-readiness`).** Dan's Aug-31→Sep-1
> refactor (`539318a7`→`4f1c8e46`) changed the deploy model this doc was
> written for:
>
> - `wrangler.jsonc` is **committed and authoritative** per app — there is no
>   `wrangler.jsonc.example` and no placeholder-substitution step.
> - Each app has `env.dev` / `env.staging` / `env.production` blocks. The
>   staging/production **worker names are pinned bare** (`baseout-web`,
>   `baseout-server`, …) so Cloudflare Workers Builds' name override matches —
>   there are NO `baseout-<app>-staging` workers.
> - **Deploys are Cloudflare Workers Builds (GitHub → dashboard), not GitHub
>   Actions.** The build command lives in the dashboard, which we cannot see.
>   For apps/web it must be the `build:staging` recipe (i.e.
>   `CLOUDFLARE_ENV=staging`), ideally preceded by `pnpm db:migrate:tunnel` —
>   the adapter flattens exactly ONE env block into the deploy artifact at
>   BUILD time, so a wrong `CLOUDFLARE_ENV` silently ships the dev flavor.
> - **Master-DB migrations live in root `db/migrations/`** and run through a
>   cloudflared tunnel at build time (`pnpm db:migrate:tunnel`), not in CI.
> - Staging + production sit on **separate Cloudflare accounts** (dev/staging
>   share `33857e356899b7369fb01c18ace8d780`).
>
> Sections below that describe `.example` placeholders, `baseout-<app>-staging`
> worker names, or `deploy-staging`/`promote-prod` GitHub Actions jobs are
> historical. Dashboard state we cannot verify from the repo is marked ❓.
> Current asks live in `openspec/changes/system-staging-readiness/tasks.md`
> Phase 3.

Related: [oauth-setup.md](./oauth-setup.md) — per-provider, per-env OAuth
app registration matrix + workarounds when URIs are missing.

---

## 1. Cloudflare — Workers + Hyperdrive + Email

### Staging (re-based 2026-09-01 — see banner)

- [x] Hyperdrive: the committed `env.staging.hyperdrive[0].id` is
      `ec6bd3583c3441569eff3a4b0d11ef30` in ALL six Workers (web, server,
      admin, api, hooks, sql) — one shared pool (~15 conns) against the
      staging PG. ❓ Which DO cluster it points at is dashboard-side (Dan).
- [ ] ❓ Workers Builds build command per app — the load-bearing setting.
      apps/web staging must run the `build:staging` recipe
      (`CLOUDFLARE_ENV=staging`), ideally `pnpm db:migrate:tunnel &&
      pnpm --filter @baseout/web build:staging`; watch paths must include
      `db/**`. apps/server staging must build with `CLOUDFLARE_ENV=staging`.
      A default `pnpm build` ships the DEV flavor: `BASEOUT_DEV=true`
      (magic-link emails silently logged, never sent), dummy Hyperdrive,
      `baseout-server-dev` service binding. Unverifiable from the repo.
- [ ] ❓ KV: `env.staging.kv_namespaces` (`SESSION`) declares no `id` —
      Workers Builds auto-provisions on first deploy. Confirm it exists.
- [x] DNS/routes: committed as custom domains — web `console.baseout.dev`,
      admin `admin.baseout.dev`, api `api.baseout.dev`, hooks
      `hooks.baseout.dev/webhooks/airtable/*`, sql `sql.baseout.dev/v1/*`.
      `console.baseout.dev` verified live 2026-09-01 (behind Cloudflare
      Access, team `staging-338`).
- [ ] ❓ Email: configure Cloudflare Email Routing so outbound mail from
      `login@mail.baseout.dev` (the committed `env.staging.vars.EMAIL_FROM` —
      note: same sending domain as prod, NOT `mail.staging.baseout.dev`) is
      deliverable, and destination addresses for test inboxes are verified
      (or the `send_email` binding is unrestricted). An unverified
      destination makes `env.EMAIL.send()` throw → 500 on
      `/api/auth/sign-in/magic-link`.
- [ ] ❓ Cloudflare Access: `console.baseout.dev` 302s ALL paths to Access
      login (verified 2026-09-01). Testers need Access grants; hosts that
      machines must reach unauthenticated (`hooks.baseout.dev`, the engine
      URL Trigger.dev tasks call back to) must be EXCLUDED from the policy,
      and Playwright needs a service-token bypass.

### Production

- [ ] Create a second Hyperdrive pointing at the prod DigitalOcean Postgres.
      Copy the id.
- [ ] Edit `wrangler.jsonc.example` → `env.production.hyperdrive[0].id` —
      replace `PROD_HYPERDRIVE_ID_PLACEHOLDER`. Commit.
- [ ] Create a KV namespace for prod sessions:
      ```
      wrangler kv namespace create SESSION-prod
      ```
      Replace `PROD_KV_PLACEHOLDER` in `env.production.kv_namespaces[0].id`
      with the returned id. Commit.
- [ ] DNS: `baseout.dev` → `baseout` Worker.
- [ ] Email: `login@mail.baseout.dev` deliverable.

- [ ] **`runtime_env` production backfill (shared-org-runtime-env D7 — BLOCKS
      merge toward main).** Migrations `0040_org_runtime_env` and
      `0041_user_runtime_env` use `DEFAULT 'staging'`. On the **separate
      production** Postgres they would tag every real Organization and user
      `staging`, and the production Worker would lock everyone out. Immediately
      after those migrations apply on prod, run:

      ```sql
      UPDATE baseout.organizations SET runtime_env = 'production';
      UPDATE baseout.users SET runtime_env = 'production';
      ```

      Confirm: `SELECT runtime_env, count(*) FROM baseout.organizations GROUP BY 1;`
      shows only `production`. The production Workers log a structured
      `production_runtime_env_lockout` error if the organizations table is
      non-empty and zero rows are tagged `production`.

### Secrets (per Cloudflare env)

For each env (`staging`, `production`), run locally with a wrangler logged into
the same account:

```
wrangler secret put --env staging BETTER_AUTH_SECRET
wrangler secret put --env staging STRIPE_SECRET_KEY
wrangler secret put --env staging STRIPE_TRIAL_PRICE_ID
wrangler secret put --env production BETTER_AUTH_SECRET
wrangler secret put --env production STRIPE_SECRET_KEY
wrangler secret put --env production STRIPE_TRIAL_PRICE_ID
```

- `BETTER_AUTH_SECRET` — generate a fresh 32-byte hex string per env. Never
  reuse between staging and prod.
- `STRIPE_SECRET_KEY` — staging uses `sk_test_*`, production uses `sk_live_*`.
- `STRIPE_TRIAL_PRICE_ID` — staging uses a test-mode `price_*`, production
  uses a live-mode `price_*`. Same Stripe account, different modes.

### Engine (@baseout/server) — deploy preconditions

The backup engine is a separate Cloudflare Worker. apps/web reaches it via
a service binding (declared in `apps/web/wrangler.jsonc.example`). The
binding's `service` field must match the engine's deployed worker name,
and a few secrets must be set per env before any request to
`/api/internal/*` returns a useful response.

**Worker names (the binding is name-matched; re-based 2026-09-01):**

| apps/web env | Web binding's `service` field | apps/server worker name (committed `apps/server/wrangler.jsonc`) |
|---|---|---|
| dev        | `baseout-server-dev` | `env.dev.name = baseout-server-dev`     |
| staging    | `baseout-server`     | `env.staging.name = baseout-server` (bare — Workers Builds name override; staging is a separate account from prod) |
| production | `baseout-server`     | `env.production.name = baseout-server`  |

All three bindings are committed. `pnpm secrets:check`
(`scripts/check-wrangler-secrets.mjs`, in CI) asserts every service link
resolves to a matching sibling env name.

### Local engine binding (align with live Openside Workers)

**Account reality (2026-08-20):** Production Workers are named **`baseout-web`**
and **`baseout-server`**. Env separation on the account is Cloudflare
**Production vs Previews** on those scripts — not a parallel
`baseout-server-dev` Worker. Web’s `SERVER` service binding must target
**`baseout-server`**.

apps/web runs `wrangler dev --remote` to keep real R2/KV/Hyperdrive/email
bindings. `--remote` refuses RFC1918/loopback `fetch()`, so the service binding
must resolve to a real deployed Worker.

**Do this (local smoke):**

```sh
# Point at the live engine (already set in wrangler.jsonc.example).
# Re-render local wrangler.jsonc if needed:
pnpm --filter @baseout/web exec node --env-file-if-exists=.env scripts/launch.mjs dev

# Only if you need a newer engine build on the LIVE script name:
pnpm --filter @baseout/server deploy
# → deploys top-level name `baseout-server` (matches dashboard / DO namespaces)

# Then:
pnpm dev   # or pnpm dev:web (+ local server if you want :8787 too)
```

**Avoid `deploy:dev` for smoke.** `wrangler deploy --env dev` publishes
`baseout-server-dev`, which hits Durable Object namespace conflicts
(`baseout-server-dev_ConnectionDO` already in use — CF 10065) and is not the
Worker Production’s `SERVER` binding uses.

**Secrets:** `SERVER_INTERNAL_TOKEN` on `baseout-server` must match web’s
`SERVER_INTERNAL_TOKEN`; `BASEOUT_ENCRYPTION_KEY` must match web’s.
Prefer `.dev.vars` + the server’s secrets sync for the script you actually
deploy (`pnpm --filter @baseout/server deploy`), not `--env dev`.

**Health checks:** `*.openside.workers.dev` may have Access policies — a bare
`curl` can return CF 1042 / Access HTML even when the Worker is healthy.
Prefer dashboard Visit / an authenticated session, or Test connection in the app.

**When to redeploy `baseout-server`:** any time `apps/server` source changes
that touch `/api/internal/*` routes the local web flow exercises.

**Gotcha — `remote: true` is required on the service binding.** Modern
Wrangler (4.x) doesn't wire service bindings to deployed sibling Workers
during local dev unless the binding entry sets `"remote": true`, even under
the legacy `wrangler dev --remote` flag. Without it, `binding.fetch()`
returns 403 from Cloudflare's edge. The flag is local-dev-only — deployed
Workers always resolve the binding to the named sibling regardless. See
`apps/web/wrangler.jsonc.example` for the canonical shape (`baseout-server`).

**Verifying the binding is healthy end-to-end:**

1. Open `https://baseout.local:4331/integrations` (apps/web dev server).
2. Click **Test connection** on the Airtable card.
3. Expected: `Connected. Airtable user: …` (success), or
   `airtable_token_rejected` (token expired — reconnect Airtable to verify).
4. If you see `engine_unreachable` / 503, redeploy the live engine via
   `pnpm --filter @baseout/server deploy` (not `deploy:dev`).
5. If you see `unauthorized` / 502, the `SERVER_INTERNAL_TOKEN` on `baseout-server`
   doesn't match `SERVER_INTERNAL_TOKEN` on apps/web — sync secrets
   from `.dev.vars` onto the script you actually deploy.

**Hyperdrive (apps/server only):** the binding is currently commented out
in `apps/server/wrangler.jsonc`. Until provisioned, the runtime falls back
to the `DATABASE_URL` secret. To enable Hyperdrive:

```
wrangler hyperdrive create baseout-server-staging --connection-string="$STAGING_DATABASE_URL"
wrangler hyperdrive create baseout-server-prod    --connection-string="$PROD_DATABASE_URL"
```

Then uncomment the `hyperdrive` block in `apps/server/wrangler.jsonc`,
swap the `<hyperdrive-id>` for the real id (per env), and re-deploy.

**Secrets (per env):**

```
# apps/server
wrangler secret put --env staging    --name baseout-server SERVER_INTERNAL_TOKEN
wrangler secret put --env staging    --name baseout-server BASEOUT_ENCRYPTION_KEY
wrangler secret put --env staging    --name baseout-server DATABASE_URL          # while Hyperdrive is commented
wrangler secret put --env staging    --name baseout-server TRIGGER_SECRET_KEY
wrangler secret put --env staging    --name baseout-server TRIGGER_PROJECT_REF
# repeat with --env production --name baseout-server (note: production worker
# is also named "baseout-server" — see env.production.name above)

# apps/web
wrangler secret put --env staging    SERVER_INTERNAL_TOKEN              # MUST equal apps/server's SERVER_INTERNAL_TOKEN
wrangler secret put --env production SERVER_INTERNAL_TOKEN
# BASEOUT_ENCRYPTION_KEY is presumably already set on apps/web (the OAuth
# callback writes encrypted tokens with it). The same value MUST be
# available to apps/server — set the engine's BASEOUT_ENCRYPTION_KEY to
# the exact same base64 string.
```

**Parity rules (the most common deploy break):**

- `apps/server.SERVER_INTERNAL_TOKEN` ≡ `apps/web.SERVER_INTERNAL_TOKEN`
  (per env). A mismatch yields 401 unauthorized at the engine middleware,
  surfaced to apps/web's route as a 502.
- `apps/server.BASEOUT_ENCRYPTION_KEY` ≡ `apps/web.BASEOUT_ENCRYPTION_KEY`
  (per env). A mismatch yields 500 `decrypt_failed` at the engine when it
  tries to decrypt a Connection's `access_token_enc`.
- `DATABASE_URL` (or Hyperdrive) on apps/server points at the **same**
  Postgres cluster apps/web writes Connections to. Otherwise the engine's
  `connection_not_found` response is just "different DB."

**Post-deploy smoke (per env):**

1. Visit the deployed apps/web URL, log in, complete the Airtable Connect
   OAuth flow if not already done. This creates a row in
   `baseout.connections`.
2. Find the `connections.id`:
   ```sql
   SELECT id, status FROM baseout.connections
     WHERE organization_id = '<your-org-id>'
     ORDER BY created_at DESC LIMIT 1;
   ```
3. On the integrations page, click **Test connection**. Expect:
   `Connected. Airtable user: <email or id> · N scopes.`
   Or curl directly (proves the engine without the IDOR-guard layer):
   ```
   curl -X POST -H "x-internal-token: $SERVER_INTERNAL_TOKEN" \
     https://baseout-server-staging.openside.workers.dev/api/internal/connections/<id>/whoami
   ```
4. If the response is non-200, the body's `error` field names the failed
   precondition (see status-code matrix in
   `apps/server/src/pages/api/internal/connections/whoami.ts`).

### Local dev: deploying baseout-admin-dev (staff console)

`apps/admin` deploys to the dev env only (staging/prod stay in the `admin`
umbrella change). It reuses the **shared dev Hyperdrive**
(`ba2652f40f864918a2da0849f24d12a2`) — same origin pool as `baseout-dev` +
`baseout-server-dev`, so it adds zero new Postgres connections. Never give
admin its own Hyperdrive config (a second 15-conn pool would saturate the
~19-conn dev cluster).

**One-time setup (per developer):**

```sh
# 1. Generate the handoff secret and paste the SAME value into BOTH files:
openssl rand -base64 32
#    → apps/web/.dev.vars    ADMIN_HANDOFF_SECRET=...
#    → apps/admin/.dev.vars  ADMIN_HANDOFF_SECRET=...   (cp .dev.vars.example .dev.vars first)

# 2. Deploy web first (picks up vars.ADMIN_APP_URL + the new secret), then admin:
pnpm --filter @baseout/web run deploy
pnpm --filter @baseout/admin run deploy

# 3. Sanity check:
curl -sI https://baseout-admin-dev.openside.workers.dev | head -1   # → HTTP/2 403 (gate live, not an open worker)
```

**Secret-parity rule:** `web.ADMIN_HANDOFF_SECRET ≡ admin.ADMIN_HANDOFF_SECRET`
(web mints the login→admin handoff token, admin opens it — a mismatch shows as
a sign-in loop on the deployed console; see `oauth-setup.md` §8). Both deploy
scripts bulk-sync their app's `.dev.vars` — never `wrangler secret put` by hand.

**Staff actions (shared-admin-actions):** admin also carries a `SERVER`
service binding to `baseout-server-dev` (declared in `wrangler.jsonc.example`,
`remote: true` so local `astro dev` proxies to the deployed dev engine) plus a
second secret in `apps/admin/.dev.vars`:
`SERVER_INTERNAL_TOKEN` — MUST equal apps/web's value (== the server's
`SERVER_INTERNAL_TOKEN`); copy it from `apps/web/.dev.vars`. Parity rule matches the
handoff secret: bulk-synced on deploy, never `wrangler secret put`. Without
binding+token the console still runs — force-backup returns 503
`server_misconfigured` and invalidate-connection skips run cancels
(`skipped_no_engine`). The `admin_audit_log` table these actions write is
owned by web's migrations (`apps/web/drizzle/0025_admin_audit_log.sql`) — run
`pnpm --filter @baseout/web db:migrate` before first use in a fresh env.

**When to redeploy:** any `apps/admin` source change; plus redeploy **web**
whenever `ADMIN_APP_URL` or the handoff secret changes.

### §D1 — Per-Space D1 provisioning token (`CLOUDFLARE_D1_API_TOKEN`)

The engine (`apps/server`) creates/deletes/queries one Cloudflare **D1 database
per Space** (`baseout-{env}-space-{spaceId}`, `server-d1-backend`) via the
Cloudflare REST API — runtime-created databases cannot be Worker bindings, so
this rides an API token instead of a binding.

**Generate** (dashboard → My Profile → API Tokens → Create Token → Custom):

- Permission: **Account → D1 → Edit** — nothing else (least privilege,
  CLAUDE.md §3.3). Scope to this account only.
- Holder: the **engine Worker only** — never web, never workflows (workflows
  reaches per-Space data only through engine internal routes).
- Set per env: engine `.dev.vars` locally (`CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_D1_API_TOKEN`, `BASEOUT_ENV`) — the deploy script bulk-syncs;
  staging/production via their own secret sets. Unset ⇒ the `d1` backend
  answers 501 and everything else is unaffected.
- The same pair also powers the D1 DB-size meter (shared-entitlements 3.2).

**Rotation:** mint the replacement token first, update `.dev.vars` (dev) /
env secrets (staging, prod), redeploy, then revoke the old token. Blast
radius note: D1:Edit can delete any D1 database on the account (Cloudflare
cannot scope per-database) — accepted risk recorded in
`openspec/changes/server-d1-backend/design.md`.

---

## 2. DigitalOcean — Postgres per env

- [ ] Create `baseout-staging` PG cluster. Smallest tier is fine until staging
      traffic is meaningful.
- [ ] Create `baseout-prod` PG cluster. Size per expected prod load.
- [ ] For each cluster, record the full connection string (`postgres://user:pass@host:port/db?sslmode=require`).
      These values become the `STAGING_DATABASE_URL` and `PROD_DATABASE_URL`
      GitHub Actions secrets — the Worker itself never sees them; only the
      `drizzle-kit migrate` step in CI does.
- [ ] In each DB, create the `baseout` schema:
      ```sql
      CREATE SCHEMA IF NOT EXISTS baseout;
      ```
      (The Worker runs `SET search_path = baseout,public` per connection.)

---

## 3. Deploy pipeline — Cloudflare Workers Builds (re-based 2026-09-01)

> The GitHub-Actions deploy model this section used to describe
> (`deploy-staging` job, `promote-prod.yml`, `STAGING_DATABASE_URL` /
> `PROD_DATABASE_URL` repo secrets) **was never built**. `.github/workflows/`
> contains CI validation only (typecheck/lint/test + `secrets:check` +
> `cron:check`) — no deploy jobs. Deploys run in Cloudflare Workers Builds,
> configured per-app in the dashboard (❓ Dan-only).

Per Workers Builds project (all ❓ until Dan confirms):

- [ ] ❓ Build command: apps/web staging = `pnpm db:migrate:tunnel &&
      pnpm --filter @baseout/web build:staging`; every other app builds with
      `CLOUDFLARE_ENV=<env>`. See the banner — a wrong/default build command
      ships the dev flavor silently.
- [ ] ❓ Watch paths: apps/web must include `db/**`, or a migration-only push
      deploys nothing and the schema silently lags the code.
- [ ] ❓ Build variables (web staging pipeline; consumed by
      `db/scripts/migrate.mjs`): `DB_TUNNEL_HOSTNAME`, `CF_CLIENT_ID`,
      `CF_CLIENT_SECRET`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (optionally
      `DB_TUNNEL_LOCAL_PORT`). Missing values fail fast with a clear error.
- [ ] ❓ Zero Trust service token + tunnel hostname exist for the staging DB.
- [ ] One-time on a fresh cluster: `CREATE SCHEMA IF NOT EXISTS baseout;`
      (drizzle's `schemaFilter: ['baseout']` will not create it — migration
      0000 fails on a bare DB), then confirm
      `drizzle.__drizzle_migrations` has 40 rows after the first build.

### GitHub repo secrets that still matter

- [ ] `NPM_TOKEN`, `FONTAWESOME_TOKEN` — used by CI installs; verify present.
- Trigger.dev task deploys (`npx trigger.dev deploy`) have **no pipeline at
  all** — Workers Builds can only run wrangler, and no GitHub Actions job
  exists. Until one is added, workflows deploys are manual (owner: ❓ Dan
  decision — see `system-staging-readiness` tasks 3.1 item 5).

---

## 4. Branch protection — deferred (CI-first enforcement)

Branch protections / Rulesets require **GitHub Pro / Team** on a private repo.
The repo is currently on the free tier, so the relevant APIs return 403. We
enforce the flow via CI workflow logic instead — see decision in
`pipeline-roadmap.md`. Specifically:

- `deploy-staging` only fires on `push` to `refs/heads/staging` and only after
  `unit + integration + build` succeed (`needs:` in `ci.yml`).
- `upload-prod-version` only fires on `refs/tags/v*.*.*` and is a candidate
  upload, not a traffic shift.
- `promote-prod` is `workflow_dispatch` only and is gated on the `production`
  environment's approver list.

When the repo upgrades to a paid plan, revisit and add:

- [ ] Protect `staging`: require PR, require `unit + integration + build`,
      require linear history, disallow direct pushes.
- [ ] Protect `main`: require PR, require reviewers (≥1), require status checks,
      restrict merge source to `staging` if the plan supports it, disallow
      direct pushes.

---

## 5. Stripe — test mode vs live mode

One Stripe account, two modes:

- [ ] In **test mode**, create the trial Product + its recurring Price. Copy
      the price id (starts `price_`) into the staging env's `STRIPE_TRIAL_PRICE_ID`.
- [ ] In **live mode**, create the same Product + Price. Copy the price id
      into the production env's `STRIPE_TRIAL_PRICE_ID`.
- [ ] Later, when webhooks are wired up, register the webhook endpoint per env
      (staging endpoint → staging domain, live endpoint → prod domain).

---

## 6. E2E email inbox (deferred)

The Playwright tracer spec at `tests/e2e/magic-link.spec.ts` is currently
`.skip()`'d. To unskip it, pick one of:

- **MailSlurp** — create a disposable inbox via API in the test setup, poll
  for the magic-link email. Requires a MailSlurp API key as a GH secret.
- **CF Email Routing catch-all** — route `*@mail.staging.baseout.com` to an
  R2 bucket or Worker that exposes a `/testing/latest?to=...` endpoint gated
  by a short-lived bearer token.
- **Dedicated test-inbox route** — a `/testing/inbox` endpoint mounted only
  when `STAGING_E2E_TOKEN` header matches.

Decide at the point of enabling the E2E. No decision needed until then.

---

## 7. First deploys

After everything above is in place:

1. Open a feature PR into `staging`. `ci.yml` runs `unit + integration + build`.
   Merge when green.
2. `ci.yml`'s `deploy-staging` job runs on the post-merge push to `staging`:
   migrate (against `STAGING_DATABASE_URL`) → `wrangler deploy --env staging` →
   curl smoke against `/api/me` (expects 401). Verify
   `https://baseout-staging.openside.workers.dev/api/me` returns 401.
3. Open a PR from `staging` → `main`. `ci.yml` runs again.
4. Merge to `main`, then tag the release: `git tag v1.0.0 && git push origin v1.0.0`.
   `ci.yml`'s `upload-prod-version` job uploads the candidate version (no
   traffic shift yet).
5. Manually run the `promote-prod` workflow from the Actions tab. Approve via
   the `production` environment gate. `wrangler versions deploy` rolls the
   uploaded version out — immediate, or gradually via the optional
   `version_spec` input.

From here forward, production is **only ever** shipped through this pipeline —
no human `wrangler deploy --env production` or `drizzle-kit migrate` against
prod. **Caveat:** prod migrations are not yet wired into `promote-prod.yml` —
running migrations against prod still requires a deliberate manual step
(`DATABASE_URL=$PROD_DATABASE_URL node scripts/migrate.mjs`). Close that gap
before V1 traffic.

---

## 8. Day-2 maintenance

- When a migration needs a careful rollout (e.g. drop column), ship the code
  that stops reading the column first, let it bake in prod, then ship the
  migration in a second release. Migration scripts are additive per release.
- If a prod deploy fails at the migration step, the previous Worker stays live.
  Investigate, fix, reship through staging.
- Rotate `BETTER_AUTH_SECRET` on a schedule; rotating staging and prod separately
  lets you test the rotation flow in staging first.

## 7. Backup smoke — local Playwright + manual click-through

Backups MVP Phase 11 has two regression gates against the deployed `baseout-dev`
worker. Run before any release that touches `apps/server/src/lib/runs/`,
`apps/server/src/pages/api/internal/runs/`, `apps/web/src/lib/backup-runs/`,
`apps/web/src/views/IntegrationsView.astro`, or
`apps/web/src/components/backups/*`.

### 7.1 Playwright happy-path (automated)

```bash
cd apps/web
TOKEN=$(grep '^E2E_TEST_TOKEN=' .dev.vars | cut -d= -f2-)
E2E_TARGET_URL=https://baseout-dev.openside.workers.dev \
E2E_TEST_TOKEN="$TOKEN" \
E2E_INBOX_DOMAIN=e2e.invalid \
pnpm test:e2e -- backup-happy-path
```

Expected: `1 passed` in ~12s. The spec seeds an `e2e-*@e2e.invalid` user with a
fully onboarded org/space/Airtable connection (one base included), signs in via
magic-link, clicks **Run backup now** on `/integrations`, and asserts a fresh
non-terminal row appears in the BackupHistoryWidget. Does NOT assert the run
reaches `succeeded` — that requires either the dev-env Trigger.dev runner
(`npx trigger.dev@latest dev` from `apps/server`) consuming the dev queue, OR
the `E2E_TEST_MODE` inline-execution short-circuit that's tracked as a
follow-up.

If `E2E_TEST_TOKEN` is missing or mismatched between local `.dev.vars` and
the deployed worker, the spec fails with `getMagicLink: no fresh token`. Resync
with `printf '%s' "$TOKEN" | pnpm exec wrangler secret put E2E_TEST_TOKEN` from
`apps/web/`.

### 7.2 Manual click-through (real Airtable, with Trigger.dev runner)

For an end-to-end demo or when verifying R2 + Trigger.dev integration:

```bash
# Terminal 1
pnpm dev:all                                  # web :4331 (HTTPS), server :8787

# Terminal 2
cd apps/server && npx trigger.dev@latest dev  # consumes dev-env queue
```

Then in a browser, signed in with a real Airtable connection and at least one
base ticked + saved:

1. Open `https://baseout.local:4331/integrations`.
2. Click **Run backup now**. Confirmation toast: "Backup started…".
3. Navigate to `/` (Home) or stay on `/integrations` — both render the
   BackupHistoryWidget.
4. Row should tick `Queued` → `Running` → `Succeeded` within ~30s.
5. Verify the CSV in R2: `wrangler r2 object list baseout-backups-dev --remote`.

If the row sticks at `Running` for > 30s, the runner in Terminal 2 isn't
consuming the queue — check its logs.

### 7.3 Deployed-end-to-end (no laptop required)

Requires a `tr_prod_*` Trigger.dev key on the deployed `baseout-server-dev`
(currently the project only has a `tr_dev_*` key, so this path is not yet
operational). To enable:

1. Generate a prod-env key in the Trigger.dev dashboard for project
   `proj_lklmptmrmrkeaszrmhcs`.
2. `cd apps/server && pnpm exec wrangler secret put TRIGGER_SECRET_KEY --env dev`
   and paste the new key.
3. The Trigger.dev cloud already has `backup-base` deployed in its prod env
   (version `20260511.1`).

After that, clicking Run backup now from `baseout-dev.openside.workers.dev`
runs end-to-end with no developer machine involved.

### 7.4 Fully-local backup loop (the default for `pnpm dev`)

The §7.2 click-through depended on the **deployed** `baseout-server-dev` engine
and on the Trigger.dev runner finding `SERVER_URL`/`SERVER_INTERNAL_TOKEN` in the
dashboard — two drift-prone wires whose silent breakage is the recurring "backups
stopped working" failure. The local loop removes both: web → engine → runner →
disk all run locally, with config sourced from local files. **This is now the
default** — `pnpm dev` (repo root) brings the whole loop up.

**It cannot leak to a deploy.** The local wiring is gated to the dev runner: it
only applies when `scripts/launch.mjs` is invoked as `… build local` (the `local`
arg is passed only by `scripts/dev.mjs`). CI and `deploy` run `launch.mjs build`
(no `local`), so the rendered `wrangler.jsonc` keeps `remote: true`; the committed
`wrangler.jsonc.example` is never edited. Opt a single dev session back onto the
deployed engine with `BACKUP_REMOTE=1` (e.g. `pnpm dev:remote`, or the `wrangler`
scripts, used for deployed-only flows like Drive Connect). To remove the feature
entirely, delete the fenced block in `launch.mjs` + the `--remote` branch in
`dev.mjs`.

**Why it works with no second database:** managed-Postgres per-Space "databases"
are *schemas* on the master connection (`CREATE SCHEMA bo_space_<uuid>`; queries
run under `SET LOCAL search_path`). Local mode points everything at one local
Postgres, so `schema-sync`/`records-sync` resolve exactly as they do in prod.

**One-time local setup:**

```sh
# apps/workflows/.env  — point the Node runner at the LOCAL engine (loopback):
#   SERVER_URL=http://localhost:8787
#   SERVER_INTERNAL_TOKEN=<same value as apps/server/.dev.vars SERVER_INTERNAL_TOKEN>
#   R2_* left blank → backups write to apps/workflows/.backups/ via LocalFsWriter
# apps/web/.dev.vars + apps/server/.dev.vars must share BASEOUT_ENCRYPTION_KEY
#   (same as today) so the runner can decrypt the Airtable OAuth token.
```

**Run:**

```bash
pnpm dev          # repo root — starts web (local) + engine :8787 + trigger dev
# or per-terminal: pnpm dev:web / pnpm dev:server / pnpm dev:workflows
# deployed engine instead: pnpm dev:remote   (web only, --remote)
```

**Verify:** open `https://baseout.local:4331`, sign in (the magic link prints to
the web terminal in dev), then Run backup on a **real Airtable** connection. The
run row goes `queued → running → succeeded`; CSVs fill `apps/workflows/.backups/…`;
the engine terminal logs `schema-sync`/`records-sync` 200s (not 409/501);
`bo_space_<uuid>.*` tables populate in the local Postgres.

**Caveats:**

- **Airtable OAuth works at `baseout.local`; Google Drive / BYOS does NOT** (their
  redirect URIs aren't registered for `.local` — see `oauth-setup.md`). This loop
  exercises the engine → per-Space → local-disk path, not BYOS destinations.
- The `SERVER_INTERNAL_TOKEN` travels over loopback `http://localhost:8787` in cleartext —
  use a throwaway local value, **never** the deployed token.
- If the web↔engine service binding shows `not connected`, the two `wrangler dev`
  sessions aren't sharing the dev registry — fall back to a single session:
  `wrangler dev -c apps/web/wrangler.jsonc -c apps/server/wrangler.jsonc`.
