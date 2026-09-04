# system-workflows-cf-builds

## Why

`apps/workflows` is the only Baseout deploy target with **no CI/CD at all**. Every other app ships through Cloudflare Workers Builds (root `.github/workflows/ci.yml`: *"Cloudflare Workers Builds (Deploy from GitHub) handles deployment after merge… No deploy job here."*). The Trigger.dev task project is deployed by a human running `pnpm --filter @baseout/workflows deploy` — undated, unlogged, from whatever happens to be checked out, against whichever Trigger.dev environment the bare `deploy` command defaults to (`prod`).

That is a correctness problem, not just a hygiene one. `apps/server` enqueues tasks by string id with types imported from this package (`tasks.trigger<typeof X>("X-id", payload)`). When the Worker deploys through CI and the task bundle deploys by hand, the two halves of that contract drift: a merged payload-shape change ships to the enqueuer automatically and to the runner whenever someone remembers.

The premise this change was opened under — "move `apps/workflows` off GitHub Actions" — turned out to be **false**, and it is worth recording. There is no GitHub Actions deploy for this app to migrate away from. The `apps/web/.github/workflows/{ci,e2e-staging,promote-prod}.yml` files that suggest otherwise are vestigial from the pre-monorepo repo: GitHub reads only the **repo-root** `.github/`, so those three files have never run in this repo. This change therefore *adds* CI/CD; it does not move it.

## What Changes

- **Add a Workers Builds pipeline for `apps/workflows`** with the shape the request described: a build command that compiles the code, and a deploy command that ships it to Trigger.dev.
  - Build: `pnpm run build` → `build:deps` (`pnpm --filter "@baseout/workflows^..." run build`) then `tsc --noEmit`.
  - Deploy: `pnpm run deploy:staging` (branch `staging`) / `pnpm run deploy:production` (branch `main`) → `trigger.dev deploy --env staging|prod`.
- **Add an anchor Worker** (`apps/workflows/wrangler.jsonc` + `apps/workflows/ci/worker-stub.ts`). Workers Builds is configured per *Cloudflare Worker*; this app is not one and must never become one. The stub is a 404 handler with no bindings, no vars, and no `env` blocks, deployed once by hand per account purely to create the `baseout-workflows` record the build trigger attaches to. CI never runs wrangler here.
- **Add the three build variables**, one of which is a latent repo-wide trap: `TRIGGER_ACCESS_TOKEN` (secret), `NODE_VERSION=22.23.2`, and `PNPM_VERSION=11.1.1`. The build image ships **pnpm 10.11.1** and does **not** read `packageManager`, while `pnpm-workspace.yaml` uses pnpm-11-only keys (`allowBuilds`, `minimumReleaseAgeExclude`) — on pnpm 10 the install fails `ERR_PNPM_IGNORED_BUILDS` and the `overrides` block carrying the `system-dep-remediation` CVE pins is **silently dropped**. Flagged for audit against the existing web/server/admin triggers.
- **Document it in the runbooks**: `shared/internal/cloudflare-env-separation.md` §8 (the Workers Builds source-of-truth), `apps/workflows/README.md` "Deploy", root `CLAUDE.md` §6.

Out of scope: touching any other app's build trigger (the `PNPM_VERSION` finding is *reported*, not fixed here — auditing three live pipelines is its own change); the actual dashboard configuration (Dan's account access — this change lands the repo-side artifacts and the exact settings to paste); Trigger.dev preview-branch deploys for non-`staging` branches; retiring the vestigial `apps/web/.github/workflows/*` files.

## Capabilities

### New Capabilities

- `workflows-deployment`: the requirement that the Trigger.dev task bundle deploys from CI on the same branch triggers as the Worker that enqueues it, so the `apps/server` ↔ `apps/workflows` task-id/payload contract cannot drift between a CI-deployed enqueuer and a hand-deployed runner.

### Modified Capabilities

_None in `openspec/specs/`._

## Impact

- **`system-*` scope, correctly.** No runtime code changes — no task body, no orchestration, no payload shape. The diff is one build-anchor Worker that never serves traffic, four `package.json` scripts, a `tsconfig.json` include, and docs. Reverting touches no `apps/*` runtime tree.
- **Deviation from the chosen option, deliberate.** The selected approach specified `src/index.ts` for the stub; it landed at `ci/worker-stub.ts` instead, so root `CLAUDE.md` §6's "there is intentionally no `src/` here" stays literally true and the directory name states its own purpose. Same file count, same behavior.
- **Verification.** `pnpm --filter @baseout/workflows run build` green (deps build + `tsc --noEmit`, with `ci/**` now inside the tsconfig `include` so the stub cannot rot). The deploy half is dashboard-gated and cannot be verified locally — see `tasks.md` §4.
- **Security.** One new credential: `TRIGGER_ACCESS_TOKEN`, a Trigger.dev personal access token, held **only** as a build-trigger secret. It is not `TRIGGER_SECRET_KEY` (the runtime enqueue key on `apps/server`) and must not be added to any `.dev.vars` — the anchor Worker serves no traffic and holds no secrets, so CLAUDE.md §3.3's `.dev.vars`-is-source-of-truth rule has nothing to bind to here. No new auth path, SQL surface, internal-API surface, or external integration. The `PNPM_VERSION` finding is a *security* finding: without the pin, CI silently reintroduces known-high CVEs.
- **Blast radius if the anchor Worker is misread.** The one real hazard is a future engineer treating `baseout-workflows` as a live Worker and adding a binding or route to it. Guarded by header comments in both files, the `ci/` directory name, and an explicit "never" in `CLAUDE.md` §6.

## Reversibility

Delete `apps/workflows/wrangler.jsonc` + `apps/workflows/ci/`, revert the `package.json` / `tsconfig.json` lines, and delete the build trigger in the dashboard. The `baseout-workflows` Worker can be deleted outright — nothing routes to it, nothing binds to it, and no DO or D1 state hangs off it. Deploys revert to the manual `pnpm --filter @baseout/workflows deploy`. No schema, no data, no cross-app contract change.
