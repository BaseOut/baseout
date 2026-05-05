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
