# Cloudflare prod/staging separation — what the docs actually say

> **⚠ SUPERSEDED 2026-09-01 (`system-staging-readiness`).** The
> "production + previews, no `env.staging`" model this file resolves to was
> **reversed** by Dan's Aug-31→Sep-1 refactor (`539318a7`→`4f1c8e46`): every
> app now has committed `env.dev`/`env.staging`/`env.production` blocks in
> `wrangler.jsonc`, staging is a real named env on a shared dev/staging
> account, and prod lives on a separate account. Current model:
> `shared/internal/ops-setup.md` (top banner). This file is history only.

**Status:** LARGELY RESOLVED 2026-08-24; **BETA DOCS + CONFIG MODEL LANDED 2026-08-25** (see the
section immediately below). Kept for the audit trail and the still-open beta questions.

---

## 2026-08-25 — beta docs exist; previews are configured from the wrangler file

Dan shared the Worker Previews closed-beta documentation (call, 2026-08-25). It supersedes the
GA docs quoted later in this file for anything previews-related:

- https://worker-previews-docs-2.preview.developers.cloudflare.com/workers/previews/
- …`/configuration/` — the `previews` config block, base config, secrets commands
- …`/resources/` — per-binding isolation matrix (DOs auto-isolate; everything else is restated)
- …`/custom-domains/` — preview custom domains (wildcard DNS + cert; Access recommended)

**The settled model (call decisions):**

1. **Bindings come from the wrangler file, not the dashboard.** A pushed config OVERRIDES
   dashboard-set values for the same key; secrets survive. The dashboard "Import from
   production" button is a known beta bug. Each app now carries its preview base config as a
   `previews` block in `wrangler.jsonc.example` (web: nested in `env.production`; server +
   admin: top level) and pushes it with `pnpm --filter @baseout/<app> preview:sync`
   (→ `wrangler preview settings update`, wrangler ≥ 4.116). Every binding a preview needs is
   RESTATED in that block — previews inherit only compat/assets/placement. This is the
   documented fix for *"no existing preview base config binding to inherit from"*.
2. **Preview secrets never copy from production.** `wrangler preview secret put <NAME>
   --worker-name <script>` (or `secret bulk`). This is the fix for *"missing required secret
   value"*. `baseout-console` + `baseout-server` preview secret rosters were already re-entered
   (verified via `wrangler preview settings --json`, 2026-08-25); `baseout-admin`'s were empty —
   `ADMIN_HANDOFF_SECRET` must be set fresh and byte-identical on BOTH console + admin previews.
3. **Cloudflare = production + previews, nothing else.** Local dev is `wrangler dev` mimicking
   the infra locally (local DOs); it never appears in the dashboard. The old `env.staging`
   blocks were deleted from web + server templates (no staging scripts ever existed).
4. **Workers Builds settings (branch pinning, build-time `DATABASE_URL` for migrations) are
   dashboard build-config and were already done by Dan** — do not re-add `DATABASE_URL` or
   routes to wrangler. Preview/production custom domains (`console.baseout.dev`,
   `admin.baseout.com`, `admin.baseout.dev`) are dashboard Custom Domains — never wrangler
   `routes`.
5. **⚠ Service bindings from previews resolve to PRODUCTION deployments** (beta docs
   `/resources/`): preview web/admin call live `baseout-server` (live DB) while their own
   HYPERDRIVE is `baseout-dev-pg`. Engine flows in previews are therefore cross-wired — open
   item for Dan (options in `openspec/changes/shared-worker-previews/design.md` D5).
6. **Preview URLs are public by default** — Cloudflare Access in front of them is Dan's
   open decision (Zero Trust dashboard).
7. **DigitalOcean build connection: on hold** — with Cloudflare builds configured it should be
   unnecessary; revisit at the Aug-26 regroup.

**2026-08-25 push results — one bug SOLVED, one escalated:**

- **10024 (Hyperdrive) is SOLVED.** The "missing required secret value" for a preview Hyperdrive
  binding is the **origin database password**, sent as an undocumented `password` field on the
  binding object. Wrangler 4.116 never sends it (verified in its source — it PATCHes only
  `{type, id}`), and neither the beta docs nor the dashboard say so, which is why every path
  failed. Working call (raw API, wrangler's own OAuth token):

  ```
  PATCH /accounts/<acct>/workers/workers/<script>
  {"previews_base_config":{"env":{"HYPERDRIVE":
    {"type":"hyperdrive","id":"<hyperdrive-id>","password":"<origin DB password>"}}}}
  ```

  Once the binding exists, later plain `{type,id}` updates inherit the secret — so
  `preview:sync` works from then on. `baseout-console` previews are now COMPLETE on both
  config fields (HYPERDRIVE→`baseout-dev-pg`, SESSION→`baseout-dev-session`, IMAGES,
  `console.baseout.dev` vars; secrets survived) and `pnpm --filter @baseout/web preview:sync`
  ran green end-to-end. Feed the `password` discovery back to Cloudflare/Dan — it should be
  in their docs and in wrangler.

- **10013 ROOT-CAUSED AND FIXED (same day):** it was NOT a per-worker platform bug — it was a
  **poisoned stored row**. `baseout-server` and `baseout-admin` had HYPERDRIVE rows sitting in
  `previews_base_config` (seeded 2026-08-24, before/around the secret requirement) **without
  the required `password` secret**. The PATCH endpoint re-validates the entire merged object on
  every write, so the stored invalid row made ANY write fail — even a no-op
  `{"logpush":false}` — surfacing as generic 10013 instead of a validation error.
  **The heal is a single PATCH that re-states the hyperdrive binding WITH the password** — the
  merged object becomes valid and the endpoint unblocks instantly. Verified: after healing,
  no-op PATCHes, `preview:sync` (server + admin), and `wrangler preview secret put` all pass.
  Diagnostic signature for next time: 10013 on every payload for one worker while identical
  payloads succeed on another ⇒ look for an invalid stored binding (likely a secretless
  hyperdrive row), not a broken endpoint.

- **End state (2026-08-25): ALL THREE workers' preview configs are COMPLETE** on both fields —
  dev HYPERDRIVE (`ba2652…`), full binding sets, `console.baseout.dev` vars, secrets intact,
  and the paired preview `ADMIN_HANDOFF_SECRET` set fresh on console + admin. Remaining smoke
  is human: Dan flips `console.baseout.dev` to Enable for Preview only, then
  magic-link on the apex; OAuth callbacks on that origin — not `staging.console.baseout.dev`.

- **Two parallel fields exist on the worker object:** `previews_base_config` (dashboard's
  "Base configuration", the older name) and `preview_defaults` (what wrangler `preview
  settings` reads/writes). Their contents drifted; all three workers' are now aligned. Keep
  both in sync until Cloudflare collapses them.

- **Solutions explored for the regroup (2026-08-25 evening — details in
  `openspec/changes/shared-worker-previews/design.md` D5–D7):**
  - *Service-binding→prod gap (D5):* recommend **token partition** now (preview
    `BACKUP_ENGINE_INTERNAL_TOKEN` ≠ prod `INTERNAL_TOKEN` → engine calls from previews fail
    cleanly instead of cross-writing DBs; zero code). Full engine-in-previews is a small,
    scoped refactor (one `getEngineBinding(env)` helper + `BACKUP_ENGINE_URL` shim pointing at
    the server's stable staging preview URL). Preview-to-preview bindings are not in the API
    today (probed; it stores but ignores extra fields) — roadmap question for the beta channel.
  - *Public previews (D6):* account has ZERO Access apps today (verified). Ready plan: Zero
    Trust free plan + one Access app, policy = `@openside.com` via One-Time PIN; the beta
    integrates Access across workers.dev + custom preview URLs. workers.dev preview URLs can
    also be toggled off separately. ~15 min once Dan approves.
  - *Preview hostname (D7):* Dan's preview origin is **`console.baseout.dev`**,
    not `staging.console.baseout.dev` (that is `wrangler preview --name staging`).
    Apex `.dev` still serves production until Domains Enable for is **Preview
    only**. Auth vars in the templates use the apex; do not preview:sync them
    until that dashboard flip.
  - *Branch pinning:* not verifiable via API from Autumn's token (builds endpoints 403) —
    confirm the build-trigger branch filter in the dashboard at the regroup.

- **Cloudflare feedback for Dan (docs/product gaps, not blockers):** (1) the hyperdrive
  `password` field is required but undocumented, and wrangler never sends it — first-time
  hyperdrive preview bindings are impossible through every official path; (2) a stored
  secretless hyperdrive row bricks the whole worker-object PATCH with an unactionable 10013 —
  it should be a targeted validation error (and the API shouldn't have accepted the row);
  (3) the dashboard "Import from production" flow is what created those poisoned rows.

**Rendered-vs-template trap (fixed 2026-08-25):** the Aug-24 cutover edits were made in the
gitignored rendered `wrangler.jsonc` files; `launch.mjs` re-renders those from
`wrangler.jsonc.example` on every dev/build, so the edits were one `pnpm dev` away from silent
reversion. All three templates now carry the cutover state (`shared-worker-previews` task 1).

---

**Pre-2026-08-25 status (2026-08-24 sync + cutover):**

- **§7 Q1 answered:** ONE Worker per app with dashboard Production + Previews (beta) — no parallel
  `-staging`/`-prod` scripts. Prod scripts: `baseout-console` (renamed from `baseout-web`),
  `baseout-server`, `baseout-admin`. §3's named-environments rewrite was indeed the wrong primary
  fix; the `env.production` blocks now kept in `wrangler.jsonc.example` are dashboard MIRRORS
  (escape hatches), not the deploy mechanism. Production ships from GitHub `main`.
- **§7 Q3 answered:** production gets its own DB (`baseout-live-pg` Hyperdrive, Dan-owned);
  previews stay on `baseout-dev-pg`.
- **Cutover done (2026-08-24):** console prod → live Hyperdrive + `baseout-live` KV,
  `E2E_TEST_MODE` stripped from prod; server prod `PUBLIC_APP_URL` → console.baseout.com;
  admin prod → console.baseout.com + `admin.baseout.com` custom domain attached; console
  preview defaults seeded via API/wrangler.
- **§4's error reproduced and narrowed:** `missing required secret value…` (code 10024) fires when
  seeding a **Hyperdrive** preview binding via API/wrangler. **Dashboard import-from-production
  also fails** (2026-08-24, `baseout-console` Previews Base): Hyperdrive-only import of
  `HYPERDRIVE` → `baseout-live-pg` returns **Try again**; Add binding `HYPERDRIVE` →
  `baseout-dev-pg` returns *binding 'HYPERDRIVE' of type 'hyperdrive' requires a secret value
  and no existing previews_base_config binding exists to inherit from*. There is no Autumn
  click-path left. **Dan / Cloudflare beta:** seed a preview Hyperdrive inherit, then retarget
  that same row to `baseout-dev-pg` (never leave it on `baseout-live-pg`). Separately,
  `baseout-server`/`baseout-admin` preview-defaults writes fail with code 10013 (unknown error)
  regardless of payload while `baseout-console` accepts identical payloads. Both stay on
  Dan's Cloudflare-feedback list.
- **§5 still open:** preview branch pinning (`staging` → console.baseout.dev) has no dashboard
  control in the beta; Dan is raising it with Cloudflare. Until then console.baseout.dev stays
  on `baseout-console` production.
- **API tokens (2026-08-24):** Autumn (`autumn@openside.com`) cannot mint the engine
  `CLOUDFLARE_D1_API_TOKEN` (Account, D1:Edit). Members shows Flagship roles only. R2
  **Account API Tokens** are hidden (“only visible to users with …”). Same gate likely
  blocks R2 S3 keys for Trigger.dev. **Dan:** Super Administrator (or token-create) for
  Autumn, or mint D1:Edit + R2 Object Read/Write(+CreateBucket) himself and hand the
  values over once (D1 → `apps/server` only; R2 → Trigger.dev only).

**Original status:** research notes, 2026-08-21. Written for the task Dan left in his Aug-20 screen recording
(*"see if you can get further than me… see if you can figure out building"*). Read before touching
the Cloudflare dashboard.

Sources: `developers.cloudflare.com/workers` (Workers Builds, Wrangler environments, service bindings),
fetched 2026-08-21.

---

## ⚠️ READ THIS FIRST — §2 and §3 are probably WRONG for our account

**Dan is in a closed beta that adds native per-environment settings** — that is what the
production/previews toggle and "import from production" in his recording are, and why he says *"this is
new"* and opens with *"they got it back working."*

The docs quoted below are the **public / GA** documentation. They describe Cloudflare **before** that
beta. So:

- **§2's headline conclusion — "Dan was fighting the wrong tool" — does not hold.** He was using a beta
  feature built to do exactly what he was trying to do. That was my error, not his.
- **Do NOT act on §3** (rewriting `wrangler.jsonc` into named environments) as the primary fix. Against
  a beta that manages the same settings natively, that risks fighting the platform and making a mess
  that is harder to unpick than the original problem.
- Public docs, community answers, and any model's training data are all **stale or silent** on this.
  The information needed is not publicly available.

**What that means practically:** the blocker is a **Dan question**, not a research task. His error may
even be a beta bug rather than anything either of you did wrong — his own opening line says the feature
had been broken and had just come back.

**Confirmed 2026-08-21: the beta's documentation lives in a Cloudflare Discord that Autumn is not a
member of.** So this task cannot be completed by whoever holds it without either (a) access to that
Discord, or (b) Dan relaying the answers. That is an access gap, not a skills gap — no amount of further
research closes it. **Getting added to that Discord is the prerequisite for owning this work.**

Still trustworthy below: **§4** (two kinds of secret), **§5** (the branch pin), **§6** (safe ordering),
**§7** (the questions for Dan).

---

## 1. The goal, in one line

`main` → **production** (real domain, live DB) · `staging` → **preview** (`console.baseout.dev`, test DB),
so SOC 2 can be shown a real change path from dev → staging → prod instead of one environment doing
every job.

## 2. The finding that matters most

From Cloudflare's own preview-environment docs:

> Workers does **not** natively support different bindings for production and non-production builds.
> Use **Wrangler Environments** to achieve similar functionality.

**This is why Dan got stuck.** He was trying to make the dashboard's production/preview toggle carry
different bindings per environment, and that is not what that toggle does. The per-environment
bindings, secrets and service names live in **`wrangler.jsonc`**, as named environments.

Good news for us: `CLAUDE.md` already states the intended model is *"production / staging per Worker
(wrangler env)"*. So the config-file approach is the direction the repo was already documented for —
it isn't a detour.

## 3. Named environments in `wrangler.jsonc`

Per-environment overrides go under `env.<name>`. Anything not overridden inherits the top level.

```jsonc
{
  "name": "baseout-web",
  "services": [{ "binding": "BACKUP_ENGINE", "service": "baseout-server" }],
  "env": {
    "staging": {
      "services": [{ "binding": "BACKUP_ENGINE", "service": "baseout-server-staging" }]
    }
  }
}
```

Deploys become environment-targeted:

```bash
npx wrangler deploy --env staging
npx wrangler deploy --env production
```

### This also fixes our currently-broken build

`apps/web/wrangler.jsonc` still binds `BACKUP_ENGINE` → `baseout-server-dev`, a Worker that was
deleted. That is why `pnpm --filter @baseout/web typecheck` / `build` die during remote-proxy setup
before typechecking anything. The fix is the pattern above, pointed at whatever the new Worker names
end up being — **the names are Dan's call**, so confirm them before editing.

## 4. Secrets are per-environment, and there are TWO kinds

This is the direct cause of Dan's error:

> missing required secret value and no existing preview base config binding exists to inherit from

Preview does **not** inherit production's secrets. It needs its own, and nothing existed to copy from.

**Runtime secrets** (what the Worker reads when serving traffic) — set per environment:

```bash
npx wrangler secret put PUBLIC_AUTH_BASE_URL --env staging
npx wrangler secret put PUBLIC_AUTH_BASE_URL --env production
```

**Build-time environment variables** (what the build command sees) are separate again, and are
attached to the **build trigger**, not the Worker. Production and preview each have their own trigger
with its own variable set — that is the box that was empty when the build refused to run.

⚠️ Our repo rule still applies: **`.dev.vars` is the source of truth for the dev Worker and the deploy
scripts sync it.** Do not start hand-running `wrangler secret put` against the dev Worker — that is the
key-drift failure that silently invalidates Airtable connections (`CLAUDE.md` §3.3, `oauth-setup.md`).
Per-environment secrets for the NEW prod/staging Workers are a different question, and worth agreeing
with Dan before anyone types it.

## 5. The one-branch pin — Dan's open question is answerable: YES

Build triggers take `branch_includes` / `branch_excludes`. What Dan enabled was the wide-open version:

| trigger | branch_includes | branch_excludes | deploy command |
|---|---|---|---|
| production | `["main"]` | `[]` | `npx wrangler deploy` |
| preview (what he got) | `["*"]` | `["main"]` | `npx wrangler versions upload` |
| **preview (what he wants)** | **`["staging"]`** | `[]` | `npx wrangler versions upload` |

So "lock it to just one branch, like staging" is simply `branch_includes: ["staging"]` on the preview
trigger instead of `["*"]`. He was looking for a GitHub/branch section and the control is the trigger's
branch filter.

Two things to note:
- Preview deploys use **`wrangler versions upload`**, not `wrangler deploy`. Different command.
- **"Isolated environments for every branch and pull request" is probably the wrong setting for us** and
  likely made the secrets error worse — every branch wanting its own binding/secret set is exactly the
  thing that had nothing to inherit from. Recommend turning it back off and using a single pinned
  `staging` trigger.

## 6. Suggested order of work — safe → needs Dan

Nothing in 1–3 changes a running system; there is no live app yet.

1. **Read-only audit.** For each of the three Workers (web, server, admin), write down what exists
   today: environments present, bindings, vars, secrets set, custom domains, build triggers. No changes.
2. **Turn OFF** "isolated environments for every branch and pull request" (§5) — reverses a setting
   that isn't wanted.
3. **Draft the `env.staging` / `env.production` blocks** in each app's `wrangler.jsonc.example` as a
   reviewable diff. Config only, deploys nothing. ⚠️ `wrangler.jsonc` itself is gitignored and rendered
   from the example by `scripts/launch.mjs` — edit the **example**.
4. **Set the preview build trigger** to `branch_includes: ["staging"]` and populate its build-time
   variables — this is what clears Dan's error.
5. **Custom domains** per environment: preview → `console.baseout.dev`, plus the admin/server
   equivalents. Then update any setting that references the old Worker names.
6. **Hyperdrive + live database — DAN'S. Do not touch.** He said he'd create "baseout live" and wire
   production to it. A wrong Hyperdrive pointer is the one change here that can reach real data.

## 7. Open questions for Dan (Monday)

**0. Which beta is this, and where are its docs?** Everything else depends on it. Specifically: does the
beta manage per-environment bindings/secrets **in the dashboard** (making §3's wrangler-environments
work unnecessary or actively harmful), or is it meant to be used *together* with named environments? Is
there a beta guide, a Cloudflare contact, or a support channel that came with the access? And is the
"no existing preview base config binding exists to inherit from" error a known beta issue — given the
feature had just come back from being broken?

1. **Worker names.** Is it `baseout-web` + `env.staging`, or separate `baseout-web-staging` Workers?
   Every binding in every app depends on this answer, and it's the thing blocking the `BACKUP_ENGINE`
   fix.
2. **Is `staging` the branch?** It doesn't exist yet. Today's work happens on `web-ui-sync-promotion`.
3. **Does staging get its own database**, or point at the existing dev DB? Note the dev Postgres
   cluster is already near its connection ceiling (~19) and Hyperdrive pools 15 — a second pool against
   the same cluster will saturate it (`reference_dev_pg_hyperdrive_conn_limits`).
4. Confirm the `.dev.vars` sync rule (§4) still holds for the new environments, or what replaces it.

## 8. `apps/workflows` — Workers Builds deploying to Trigger.dev (2026-09-03)

`apps/workflows` is the one app whose Workers Build **does not deploy a Worker**. It is a Trigger.dev
task project (root `CLAUDE.md` §6): the tasks run on Trigger.dev's Node runner, and the deploy command
is `trigger.dev deploy`, not `wrangler deploy`. Before this, the app had no CI/CD at all — it was
deployed by hand. There was never a GitHub Actions deploy for it to migrate away from (root
`ci.yml` only tests; the `apps/web/.github/workflows/*` files are vestigial — GitHub reads only the
repo-root `.github/`).

### The anchor Worker

Workers Builds is configured **per Cloudflare Worker**, so a Worker record must exist for the build
trigger to attach to. `apps/workflows/wrangler.jsonc` + `apps/workflows/ci/worker-stub.ts` create one —
a 404 handler, no bindings, no vars, no `env` blocks. Bootstrap once per account:

```bash
pnpm --filter @baseout/workflows exec wrangler deploy
```

CI never runs wrangler for this app, so `baseout-workflows` stays pinned at that stub version forever
and shows as never-redeployed in the dashboard. That is expected, not a broken build. The
staging/production split lives entirely in the **deploy command** (`--env staging` vs `--env prod` on
the Trigger.dev side), which is why the config has no `env` blocks to drift.

### Build-trigger settings

| Setting | staging account (`staging` branch) | production account (`main`) |
| --- | --- | --- |
| Root directory | `apps/workflows` | `apps/workflows` |
| Build command | `pnpm run build` | `pnpm run build` |
| Deploy command | `pnpm run deploy:staging` | `pnpm run deploy:production` |
| Watch paths | `apps/workflows/**`, `packages/shared/**`, `packages/db-schema/**`, `pnpm-lock.yaml` | same |
| `branch_includes` | `["staging"]` | `["main"]` |

`pnpm run build` = `build:deps` (`pnpm --filter "@baseout/workflows^..." run build`) then `tsc --noEmit`.
The deps build is **not optional**: `@baseout/shared` resolves through `./dist/*`, so skipping it means
`trigger.dev deploy` bundles against files that do not exist.

### Build variables — three, and two of them are version pins

| Variable | Value | Kind |
| --- | --- | --- |
| `TRIGGER_ACCESS_TOKEN` | `tr_pat_…` (Trigger.dev → profile → Personal Access Tokens) | **secret** |
| `PNPM_VERSION` | `11.1.1` | var |
| `NODE_VERSION` | `22.23.2` | var |

⚠️ **`PNPM_VERSION` is load-bearing, and this trap applies to every app's build trigger, not just
workflows.** The Workers Builds image ships **pnpm 10.11.1** and does **not** read `packageManager`
from `package.json`. This repo is pinned to `pnpm@11.1.1` and `pnpm-workspace.yaml` uses pnpm-11-only
keys: `allowBuilds` (pnpm 10 spells it `onlyBuiltDependencies`) and `minimumReleaseAgeExclude`. On
pnpm 10 the install fails with `ERR_PNPM_IGNORED_BUILDS`, and the `overrides` block that carries the
`system-dep-remediation` CVE pins is silently ignored — a green build that quietly reintroduces known
highs. Audit the existing web/server/admin build triggers for this pin.

`TRIGGER_ACCESS_TOKEN` is the **personal access token**, not `TRIGGER_SECRET_KEY` (that one is a
*runtime* secret on `apps/server`, used to enqueue). It is build-time only — the anchor Worker never
serves traffic, so it holds no secrets at all, and §4's two-kinds-of-secrets distinction collapses to
one kind here.

Not needed: `TRIGGER_PROJECT_REF` (in `trigger.config.ts`), `TRIGGER_API_URL` (self-hosted only),
`NPM_TOKEN` / `FONTAWESOME_TOKEN` (root `.npmrc` redirects are commented out; `@opensided` is vendored
via `file:`), any `CLOUDFLARE_API_TOKEN`.

Task **runtime** config (`BACKUP_ENGINE_URL`, `INTERNAL_TOKEN`, `AIRTABLE_*`, BYOS keys) is not a
Cloudflare concern in either direction — it lives in Trigger.dev's own environment-variables UI, per
Trigger.dev environment.

Full per-app detail: [`apps/workflows/README.md`](../../apps/workflows/README.md) "Deploy".
Change record: `openspec/changes/system-workflows-cf-builds/`.
