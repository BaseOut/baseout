# system-workflows-cf-builds — design

## D1. Anchor Worker vs piggybacking on `apps/server`'s build

Workers Builds is configured **per Cloudflare Worker**. `apps/workflows` has no Worker and, per root `CLAUDE.md` §6, must never have one. Two ways out:

**Option A — piggyback (rejected by Dan, 2026-09-03).** Extend `baseout-server`'s existing deploy command to `pnpm --filter @baseout/workflows run deploy:staging && npx wrangler deploy --env staging`, and add `apps/workflows/**` to its watch paths. No new Worker; the ordering (tasks first, enqueuer second) matches the real dependency, since `apps/server` references task ids that must already exist. Cost: a workflows-only change redeploys the Worker too, and one build log covers two deploy targets.

**Option B — dedicated anchor Worker (chosen).** A `baseout-workflows` Worker that exists only to host the build trigger. Cost: a Worker in the dashboard that never has a real deployment. Benefit: isolated build logs, independent branch triggers, and a workflows-only change deploys only workflows.

Dan chose B with the phantom-Worker trade-off explicit.

## D2. `ci/worker-stub.ts`, not `src/index.ts`

The option as presented specified `apps/workflows/src/index.ts`. It landed at `apps/workflows/ci/worker-stub.ts`.

Root `CLAUDE.md` §6 states "There is intentionally no `src/`… here" — that sentence exists so nobody wonders which files run in workerd and which on the Node runner, the exact confusion that motivated splitting `apps/workflows` out of `apps/server` in the first place. Creating `src/` to hold a file that runs in *neither* would invert the sentence's meaning while adding zero clarity. `ci/` names its own purpose, is unmistakable at a glance in a directory listing, and keeps the §6 rule literally true.

Identical file count and behavior; `wrangler.jsonc`'s `main` points at it either way. Recorded because it deviates from the approved preview text.

## D3. No `env` blocks in the anchor `wrangler.jsonc`

`apps/server/wrangler.jsonc` carries full `env.dev` / `env.staging` / `env.production` blocks because its bindings are non-inheritable and a `--env` deploy that omits them strips them off the live Worker. None of that applies here: the anchor has no bindings, no vars, and no secrets, and **wrangler never runs in CI for this app** — the deploy command is `trigger.dev deploy`.

The staging/production distinction therefore lives entirely in the deploy command (`--env staging` vs `--env prod`, Trigger.dev's environments inside the one project `proj_lklmptmrmrkeaszrmhcs`). Adding `env` blocks would create three copies of a config nothing reads — pure drift surface. `workers_dev: false` and `observability: false` keep the stub off a public hostname and out of the log bill.

Both accounts use the bare name `baseout-workflows`, matching the `apps/server` convention: the staging Worker lives in the staging account, production in its own account, so the names cannot collide, and Workers Builds overrides the name via `WRANGLER_CI_OVERRIDE_NAME` regardless.

## D4. `build` = deps + typecheck

`trigger.dev deploy` does its own bundling on Trigger.dev's cloud builder (Depot — no Docker in the build container), so there is no artifact for a Cloudflare build step to hand off. The build command still has two jobs:

1. **`build:deps` is mandatory, not hygiene.** `@baseout/shared` resolves through `./dist/*` in its `exports` map. Without `pnpm --filter "@baseout/workflows^..." run build`, `trigger.dev deploy` bundles against files that do not exist. This mirrors `apps/server`'s existing `build:deps`.
2. **`tsc --noEmit` as the deploy gate.** Root `ci.yml` already typechecks on push, but it is a *separate* pipeline: nothing makes a red `ci.yml` block a Workers Build. Typechecking inside the build command is what stops a broken bundle from reaching Trigger.dev, and it costs seconds. `ci/**` was added to the tsconfig `include` so the stub is covered too.

The existing bare `deploy` script is left untouched (`CLAUDE.md` §3.2) — the two `deploy:*` scripts are additive.

## D5. `PNPM_VERSION=11.1.1` — a repo-wide latent failure found here

The Workers Builds image ships **pnpm 10.11.1**, overridable only via the `PNPM_VERSION` build variable; it does **not** read `packageManager` from `package.json`. This repo is `packageManager: pnpm@11.1.1`, and `pnpm-workspace.yaml` uses two pnpm-11-only keys:

- `allowBuilds` — pnpm 10 spells this `onlyBuiltDependencies`. Unrecognized, so every listed postinstall (`esbuild`, `workerd`, `sharp`, `msw`, `cloudflared`, …) is ignored and the install hard-fails with `ERR_PNPM_IGNORED_BUILDS` under pnpm 11's `strictDepBuilds` default — or, worse on pnpm 10, succeeds with unbuilt binaries.
- `minimumReleaseAgeExclude` — carries the `@trigger.dev/*` exemption. Without it the age gate cannot compute an age for `@trigger.dev/build` (no `time` metadata) and fails the install.

And the quiet one: pnpm 10 reads `overrides` from `pnpm-workspace.yaml`, but the whole block exists because the pnpm 9→11 upgrade orphaned `package.json`'s `pnpm.overrides` — that header comment names it as "the root cause of the CVE regression". Any version skew in this area produces a **green build with known-high CVEs restored**.

Pinning `PNPM_VERSION` on the workflows trigger is in scope. Auditing the live web/server/admin triggers for the same pin is **reported, not fixed** — three live pipelines, dashboard access required, and its own change.

## D6. `TRIGGER_ACCESS_TOKEN` is build-time only

Two distinct Trigger.dev credentials, routinely confused:

| Credential | Where | Purpose |
| --- | --- | --- |
| `TRIGGER_SECRET_KEY` (`tr_dev_…`) | `apps/server` runtime secret | Lets the Worker *enqueue* tasks |
| `TRIGGER_ACCESS_TOKEN` (`tr_pat_…`) | Workers Builds **build-trigger secret** | Lets CI *deploy* the task bundle |

The access token is the only credential the deploy needs (`TRIGGER_API_URL` is self-hosted-only; `TRIGGER_PROJECT_REF` is already in `trigger.config.ts`). It must not go into any `.dev.vars`: `CLAUDE.md` §3.3 makes `.dev.vars` the source of truth for a *Worker's* deployed secret set, and the anchor Worker has no secret set — it serves no traffic. Putting it there would sync a deploy credential onto a live Worker for no reason.
