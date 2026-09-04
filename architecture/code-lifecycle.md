# Baseout — Code Lifecycle

**Status:** written 2026-09-04. Companion to
[systems-overview.md](systems-overview.md) (which covers *what runs where*); this
covers *how code gets there*. Drawn in [`architecture/diagram/`](diagram/) →
**Code deployment** tab.

Everything below was verified against the live repo and GitHub API on 2026-09-04,
not inferred from intent. Where a claim could not be verified, it says so.

---

## 1. Two branches, two roles

| Branch | Role | Deploys to | Protected |
|---|---|---|---|
| `staging` | Integration. Direct push is normal. | staging Workers | **No** |
| `main` | Default branch. Release. | production Workers | **Yes — PR required** |

There is no long-lived `develop`, and no per-developer deploy branch. Feature work
happens on `change/<name>` branches (matching the OpenSpec change name where one
exists) and lands on `staging` first.

### `main`'s protection rule, as actually configured

```
required approving reviews    1
required status checks        NONE          ← see §6
dismiss stale reviews         false
require code-owner review     false
enforce admins                false         ← admins bypass the rule
allow force pushes            false
allow deletions               false
required linear history       false
conversation resolution       false
```

`staging` has **no** protection rule at all — the API returns
`"Branch not protected"`. Direct pushes, force pushes, and deletion are all
possible there. That is deliberate for an integration branch, but it is worth
knowing rather than assuming.

---

## 2. Commit to running code

```
                    ┌─────────────────── staging path ───────────────────┐
  local commit  ──▶ push to `staging`
                         │
                         ├──▶ GitHub Actions: ci.yml + (main only) codeql
                         │      advisory — nothing blocks the push
                         │
                         └──▶ Cloudflare Workers Builds  ──▶ staging Workers
                                (9 projects, in parallel)


                    ┌───────────────── production path ─────────────────┐
  `staging`  ──▶ Pull Request ──▶ `main`
                         │
                         ├──▶ ci.yml + codeql run on the PR
                         ├──▶ 1 approving review REQUIRED to merge
                         │
                         └── merge ──▶ Workers Builds ──▶ production Workers
```

Two properties follow, and both matter:

- **Deployment is triggered by the merge, not by a person.** Nobody runs
  `wrangler deploy` from a laptop. The `deploy:dev` scripts exist for local
  one-offs against the dev environment only.
- **A push to `staging` deploys immediately.** There is no gate between the push
  and the staging estate, because `staging` has no protection rule and no
  required check. Treat a `staging` push as a deploy.

---

## 3. What GitHub does — and does not do

**Does:** runs `ci.yml` on every push and pull request against `main` and
`staging`, and `codeql.yml` on `main` (plus a schedule).

`ci.yml` is a single `test` job on `ubuntu-latest`, in order:

| Step | Notes |
|---|---|
| Set up pnpm / Node, install | — |
| Validate lat.md graphs | `lat check` |
| **Check wrangler secrets parity** | `scripts/check-wrangler-secrets.mjs` — the same guard described in systems-overview §10.6 |
| Check cron triggers match dispatch map | cron strings must match `src/lib/cron/dispatch.ts` |
| Render wrangler.jsonc (apps/web) | **vestigial** — `render-config` is a no-op since `wrangler.jsonc` became committed and authoritative. Kept so `pretypecheck` keeps working |
| Generate Cloudflare types (apps/web) | `wrangler types` |
| Typecheck · Lint · Test · Web unit tests | — |
| Build Storybook (apps/web) | enforces the story-coverage rule |

**Does NOT:** deploy anything. That changed on 2026-09-03 when `apps/workflows`
moved from GitHub Actions to Workers Builds. No workflow in `.github/workflows/`
runs `wrangler deploy` or `trigger.dev deploy`; `ci.yml` says so in a comment.

---

## 4. Secrets live only in Cloudflare

**Verified 2026-09-04:** the repository has **zero** GitHub Actions secrets, zero
repository variables, and zero Dependabot secrets (`total_count: 0` on all
three). Nothing needs them, because nothing in GitHub deploys.

| Kind | Where it lives | How it gets there |
|---|---|---|
| **Runtime secrets** | Cloudflare, per Worker per environment | `wrangler secret bulk .env.secrets.<env> --env <env>` from a gitignored local file |
| **Build variables** | Cloudflare Workers Builds, per project | Dashboard. e.g. `TRIGGER_ACCESS_TOKEN`, `TRIGGER_PROJECT_REF`, `PNPM_VERSION`, `NODE_VERSION`, and web's six DB-tunnel variables |
| **Non-secret config** | `vars` in the committed `wrangler.jsonc` | Git. A client ID is not a secret — see the `AIRTABLE_OAUTH_CLIENT_ID` note below |
| **Local dev** | `apps/*/.dev.vars`, `db/.dev.vars` | Never committed; `.dev.vars*` is gitignored |

Why one control plane rather than two: a secret in GitHub would have to be copied
into Cloudflare to be useful at runtime, and two copies drift. The consequence of
drift here is severe and silent — `BASEOUT_ENCRYPTION_KEY` mismatch flips Airtable
connections to `status='invalid'` and forces customer reconnects.

`secrets.required` in each `wrangler.jsonc` is the enforcement: a missing secret
**fails the deploy** rather than producing a broken Worker.

**A var and a secret of the same name is a trap.** The secret wins at runtime. When
`AIRTABLE_OAUTH_CLIENT_ID` became a committed `var`, a stale row left behind in
`.env.secrets` would have silently shadowed it.

---

## 5. Cloudflare Workers Builds — the deploy engine

Git-connected, one project per deployable unit, **nine** in total: `web`, `admin`,
`server`, `api`, `hooks`, `sql`, `support`, `workflows`, and `diagram`.

Each project has exactly two fields, and they never duplicate each other:

| Field | Value |
|---|---|
| Build command | `pnpm --filter @baseout/<app> run build:<env>` |
| Deploy command | `pnpm --filter @baseout/<app> run deploy:<env>` |

Every deployable project exposes `build:dev`, `build:staging`, and
`build:production` so the field reads identically across all nine, even where the
build is thin.

**`workflows` is the exception that proves the rule.** Its deploy command is
`trigger.dev deploy`, not `wrangler deploy` — Workers Builds attaches per
*Cloudflare Worker*, so a 404 stub Worker (`baseout-workflows`) exists purely to
give the build trigger something to hang off. `check-wrangler-secrets.mjs` skips
it, keyed on whether `deploy:staging` actually invokes `wrangler deploy`.

**Two ordering facts:**

- **Database migrations are chained into web's build command**
  (`pnpm db:migrate:tunnel && <astro build>`), so a failed migration fails the
  build and the app most coupled to the schema cannot deploy ahead of it.
- **Nothing orders the nine pipelines against each other.** They fire in parallel
  on one push. That is why `pnpm db:migrate` wraps `drizzle-kit` in a
  `pg_advisory_lock`, and why **expand-then-contract is mandatory, not advisory**
  (root `CLAUDE.md` §3.9): the additive half of a schema change ships in release
  *n*, the destructive half no earlier than *n+1*.

**Worker naming is asymmetric on purpose.** Workers Builds forces the script onto
whichever Worker the build is connected to via `WRANGLER_CI_OVERRIDE_NAME`. The
connected Workers are unsuffixed, so `env.staging` and `env.production` pin the
bare name explicitly while `env.dev` derives `<name>-dev`. Details in
systems-overview §2.

Branch → environment comes from the per-project build configuration in the
Cloudflare dashboard: `staging` → the staging estate, `main` → production. **Not
independently verified** — the Workers Builds configuration API rejected the
account token available here, so this reflects the wrangler config comments and
systems-overview §12 rather than a live read.

---

## 6. Known gaps

Recorded because each one is a real risk, not a hypothetical.

1. **CI is not a required status check on `main`.** `required_status_checks` is
   `None`, so a pull request can merge with `ci.yml` red. The review requirement
   is the only gate. Adding `test` as a required check is a one-setting change and
   is the highest-value hardening available here.
2. **`enforce_admins` is false.** An admin can push straight to `main`, bypassing
   the PR requirement entirely.
3. **`staging` is unprotected.** Force-push and deletion are possible, and a push
   deploys straight to the staging estate with no gate.
4. **`delete_branch_on_merge` is false**, so merged `change/*` branches accumulate.
5. **All three merge strategies are enabled** (merge, squash, rebase) with no
   required linear history, so `main`'s shape depends on who merges.
6. **The `Render wrangler.jsonc` CI step is dead weight** — it invokes a no-op.
   Harmless, but it implies a rendering step that no longer exists.
7. **`build-db.baseout.dev` does not resolve** (as of 2026-09-04), so
   `db:migrate:tunnel` inside web's build command fails — which fails web's build,
   which is the intended direction but blocks deploys until DNS is restored.

---

## Related

- [systems-overview.md](systems-overview.md) — what runs where; §12 is the CI/CD summary this document expands
- [`shared/internal/cloudflare-env-separation.md`](../shared/internal/cloudflare-env-separation.md) §8 — the workflows Workers Builds setup
- [`db/tunnel/README.md`](../db/tunnel/README.md) — the local tunnel the migration step depends on
- root [`CLAUDE.md`](../CLAUDE.md) §3.8 (commit format), §3.9 (migration rules)
