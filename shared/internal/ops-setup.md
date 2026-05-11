# Ops Setup Checklist — Staging + Production

Bootstrap the `feature → staging → main → prod` pipeline. This is one-time work
(per-environment) performed outside the repo, in the Cloudflare dashboard,
DigitalOcean, GitHub repo settings, and Stripe.

Owner: the engineer provisioning the environment.

---

## 1. Cloudflare — Workers + Hyperdrive + Email

### Staging

- [ ] In the Cloudflare dashboard, create a Hyperdrive config pointing at the
      staging DigitalOcean Postgres (see §2). Copy the Hyperdrive **id**.
- [ ] Edit `wrangler.jsonc.example` → `env.staging.hyperdrive[0].id` — replace
      `STAGING_HYPERDRIVE_ID_PLACEHOLDER` with the real id. Commit.
- [ ] Create a KV namespace for staging sessions:
      ```
      wrangler kv namespace create SESSION-staging
      ```
      Replace `STAGING_KV_PLACEHOLDER` in `env.staging.kv_namespaces[0].id`
      with the returned id. Commit.
- [ ] DNS (deferred): the staging Worker defaults to
      `baseout-staging.openside.workers.dev`, which the deploy-staging CI
      smoke step targets directly — no DNS work needed for v1. When a
      custom domain is desired, point `staging.baseout.dev` at the
      `baseout-staging` Worker via Workers Route or CNAME, then update
      `env.staging.vars.PUBLIC_AUTH_BASE_URL` and the smoke URL in
      `.github/workflows/ci.yml`'s `deploy-staging` job.
- [ ] Email: configure Cloudflare Email Routing (or SES, or MailChannels)
      so outbound mail from `login@mail.staging.baseout.dev` is deliverable.
      The Worker uses the `send_email` binding, which maps to whichever
      sender is configured for the Worker.

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

**Worker names (the binding is name-matched):**

| apps/web env | Web binding's `service` field | apps/server worker name (set in `apps/server/wrangler.jsonc.example`) |
|---|---|---|
| dev        | `baseout-server-dev`     | `env.dev.name = baseout-server-dev`         |
| staging    | `baseout-server-staging` | `env.staging.name = baseout-server-staging` |
| production | `baseout-server`         | `env.production.name = baseout-server`      |

The dev binding lands first per openspec change `baseout-web-server-service-binding`.
Staging + production bindings are deferred to a follow-up openspec change
(those Workers aren't deployed yet — declaring the binding now would
fail-resolve at deploy).

### Local dev: deploying baseout-server-dev

apps/web runs `wrangler dev --remote` to keep real R2/KV/Hyperdrive/email
bindings during local dev. `--remote` runs the Worker on Cloudflare's edge,
which refuses outbound `fetch()` to RFC1918/loopback (so `http://localhost:4341`
returns 403). The service binding sidesteps this — but it has to resolve to a
real deployed Worker.

**One-time setup (per developer):**

```sh
# 1. Set the three required Cloudflare Secrets on the dev env:
pnpm --filter @baseout/server exec wrangler secret put INTERNAL_TOKEN --env dev
pnpm --filter @baseout/server exec wrangler secret put BASEOUT_ENCRYPTION_KEY --env dev
pnpm --filter @baseout/server exec wrangler secret put DATABASE_URL --env dev
# (Values: pull from your local apps/server/.dev.vars — same secrets the
#  team's existing dev DB uses. INTERNAL_TOKEN must match apps/web's
#  BACKUP_ENGINE_INTERNAL_TOKEN; BASEOUT_ENCRYPTION_KEY must match apps/web's.)

# 2. Deploy:
pnpm --filter @baseout/server deploy:dev

# 3. Sanity check:
curl https://baseout-server-dev.openside.workers.dev/api/health           # → 200 + JSON liveness
curl -X POST https://baseout-server-dev.openside.workers.dev/api/internal/ping  # → 401 unauthorized (proves the gate is live)
```

**When to redeploy:** any time `apps/server` source changes that touch
the test-connection probe path or any `/api/internal/*` route the dev
flow exercises. The redeploy takes ~10 seconds.

**Gotcha — `remote: true` is required on the service binding.** Modern
Wrangler (4.x) doesn't wire service bindings to deployed sibling Workers
during local dev unless the binding entry sets `"remote": true`, even under
the legacy `wrangler dev --remote` flag. Without it, `binding.fetch()`
returns 403 from Cloudflare's edge. The flag is local-dev-only — deployed
Workers always resolve the binding to the named sibling regardless. See
`apps/web/wrangler.jsonc.example` for the canonical shape.

**Verifying the binding is healthy end-to-end:**

1. Open `https://localhost:4331/integrations` (apps/web dev server).
2. Click **Test connection** on the Airtable card.
3. Expected: `Connected. Airtable user: …` (success), or
   `airtable_token_rejected` (token expired — reconnect Airtable to verify).
4. If you see `engine_unreachable` / 503, redeploy via `pnpm --filter @baseout/server deploy:dev`.
5. If you see `unauthorized` / 502, the `INTERNAL_TOKEN` on apps/server doesn't
   match `BACKUP_ENGINE_INTERNAL_TOKEN` on apps/web — re-run `wrangler secret put`
   on the side that's wrong.

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
wrangler secret put --env staging    --name baseout-server INTERNAL_TOKEN
wrangler secret put --env staging    --name baseout-server BASEOUT_ENCRYPTION_KEY
wrangler secret put --env staging    --name baseout-server DATABASE_URL          # while Hyperdrive is commented
wrangler secret put --env staging    --name baseout-server TRIGGER_SECRET_KEY
wrangler secret put --env staging    --name baseout-server TRIGGER_PROJECT_REF
# repeat with --env production --name baseout-server (note: production worker
# is also named "baseout-server" — see env.production.name above)

# apps/web
wrangler secret put --env staging    BACKUP_ENGINE_INTERNAL_TOKEN              # MUST equal apps/server's INTERNAL_TOKEN
wrangler secret put --env production BACKUP_ENGINE_INTERNAL_TOKEN
# BASEOUT_ENCRYPTION_KEY is presumably already set on apps/web (the OAuth
# callback writes encrypted tokens with it). The same value MUST be
# available to apps/server — set the engine's BASEOUT_ENCRYPTION_KEY to
# the exact same base64 string.
```

**Parity rules (the most common deploy break):**

- `apps/server.INTERNAL_TOKEN` ≡ `apps/web.BACKUP_ENGINE_INTERNAL_TOKEN`
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
   curl -X POST -H "x-internal-token: $INTERNAL_TOKEN" \
     https://baseout-server-staging.openside.workers.dev/api/internal/connections/<id>/whoami
   ```
4. If the response is non-200, the body's `error` field names the failed
   precondition (see status-code matrix in
   `apps/server/src/pages/api/internal/connections/whoami.ts`).

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

## 3. GitHub Actions — secrets

Under **Settings → Secrets and variables → Actions** on the repo:

### Repository secrets (available to every workflow)

- [ ] `CLOUDFLARE_API_TOKEN` — scope: Edit Cloudflare Workers + Hyperdrive read/write
- [ ] `CLOUDFLARE_ACCOUNT_ID`
- [ ] `NPM_TOKEN` — already set; verify present
- [ ] `FONTAWESOME_TOKEN` — already set; verify present
- [ ] `STAGING_DATABASE_URL` — from DO staging cluster. Used by the
      `deploy-staging` job in `ci.yml` for the migrate step. Repo-level
      (not env-scoped) because the deploy-staging job has no environment
      gate.
- [ ] `PROD_DATABASE_URL` — from DO prod cluster. Used when the prod
      promotion path adds a migrate step (currently `promote-prod.yml`
      only runs `wrangler versions deploy` — migrations land
      out-of-band until that gap is closed).

### Environments

The `production` environment already exists (used by `promote-prod.yml`
for human approval gating).

- [ ] Verify the `production` environment's reviewer list is correct.
      Every manual run of the `promote-prod` workflow waits on an
      approver before `wrangler versions deploy` fires.
- [ ] No `staging` environment is required — `deploy-staging` runs on
      every push to the `staging` branch with no approval gate
      (CI-first enforcement; see §4).

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

1. Open `https://localhost:4331/integrations`.
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
