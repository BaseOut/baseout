# Cloudflare prod/staging separation — what the docs actually say

**Status:** LARGELY RESOLVED 2026-08-24 (Dan/Autumn sync + same-day cutover). Kept for the audit
trail and the still-open beta questions. What happened:

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
