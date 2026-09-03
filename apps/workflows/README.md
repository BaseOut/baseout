# @baseout/workflows

Trigger.dev v3 task project. Tasks run on Trigger.dev's Node runner — NOT inside a Cloudflare Worker. Enqueued from `apps/server` (the Worker) via the `@trigger.dev/sdk` `tasks.trigger()` call. See root `CLAUDE.md` for the broader split.

## Local dev

```bash
pnpm install
pnpm --filter @baseout/workflows dev
```

`pnpm dev` runs `trigger dev`, which connects to Trigger.dev's cloud and registers the local tasks for inbound enqueue requests. Set `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_REF` in this directory's `.env` (or inherit from a parent).

## Tests

```bash
pnpm --filter @baseout/workflows test
pnpm --filter @baseout/workflows typecheck
```

Tests use plain Vitest (Node environment). External APIs (Airtable, R2/local FS, engine HTTP) are mocked at the boundary.

## Deploy

Deployment is driven by **Cloudflare Workers Builds**, the same CI/CD path every other Baseout app uses — not GitHub Actions. The root `.github/workflows/ci.yml` runs typecheck/lint/test on PRs and pushes; it does not deploy.

Workers Builds runs two commands per build:

| Command | Value | What it does |
| --- | --- | --- |
| Build | `pnpm run build` | `build:deps` (builds the workspace deps — `@baseout/shared` resolves to `dist/*`, so it **must** be built before the task bundle is assembled) then `tsc --noEmit` |
| Deploy (`main`) | `pnpm run deploy:production` | `trigger.dev deploy --env prod` |
| Deploy (`staging`) | `pnpm run deploy:staging` | `trigger.dev deploy --env staging` |

`trigger.dev deploy` bundles and ships to Trigger.dev's cloud builder (Depot) — no Docker in the build container, no Cloudflare Worker version produced. Both branches target the same project (`proj_lklmptmrmrkeaszrmhcs`); Trigger.dev *environments* separate the runs.

### Build-trigger settings

Per account (staging account for the `staging` branch, the separate production account for `main`):

| Setting | Value |
| --- | --- |
| Root directory | `apps/workflows` |
| Build command | `pnpm run build` |
| Deploy command | `pnpm run deploy:staging` / `pnpm run deploy:production` |
| Build watch paths | `apps/workflows/**`, `packages/shared/**`, `packages/db-schema/**`, `pnpm-lock.yaml` |
| Branch include | `staging` / `main` |

### Build variables

All three are set on the **build trigger** (build-time), not as Worker secrets — the anchor Worker never runs, so it needs nothing.

| Variable | Value | Kind | Why |
| --- | --- | --- | --- |
| `TRIGGER_ACCESS_TOKEN` | `tr_pat_…` | **secret** | The only credential `trigger.dev deploy` needs. From Trigger.dev → profile → *Personal Access Tokens*. **Not** `TRIGGER_SECRET_KEY` — that is the runtime key `apps/server` uses to *enqueue*. |
| `PNPM_VERSION` | `11.1.1` | var | **Load-bearing.** The build image ships pnpm 10.11.1; this repo is `packageManager: pnpm@11.1.1` and `pnpm-workspace.yaml` uses pnpm-11-only keys (`allowBuilds`, which pnpm 10 calls `onlyBuiltDependencies`; `minimumReleaseAgeExclude`). On pnpm 10 the install fails with `ERR_PNPM_IGNORED_BUILDS` and the CVE `overrides` from `system-dep-remediation` are silently dropped. Cloudflare does **not** read `packageManager`. |
| `NODE_VERSION` | `22.23.2` | var | Image default is 24.18.0; root `ci.yml` tests on 22, and 22.23.2 is preinstalled in the image (no download). |

Deliberately **not** needed:

- `TRIGGER_PROJECT_REF` — `trigger.config.ts` carries `proj_lklmptmrmrkeaszrmhcs`.
- `TRIGGER_API_URL` — self-hosted Trigger.dev only.
- `NPM_TOKEN` / `FONTAWESOME_TOKEN` — root `.npmrc` has both registry redirects commented out; `@opensided` packages are vendored via `file:`.
- Any `CLOUDFLARE_API_TOKEN` — wrangler never runs in this app's builds.

Task *runtime* config (`BACKUP_ENGINE_URL`, `INTERNAL_TOKEN`, `AIRTABLE_*`, BYOS keys) is not a build variable — it lives in Trigger.dev's own environment-variables UI, per Trigger.dev environment. See **Runtime** below.

### The anchor Worker

Workers Builds attaches to a Cloudflare *Worker*, and this app is not one. `wrangler.jsonc` + `ci/worker-stub.ts` exist solely to create a `baseout-workflows` Worker record for the build trigger to hang off of. Bootstrap it once per account, then never again:

```bash
pnpm --filter @baseout/workflows exec wrangler deploy
```

CI never runs `wrangler` for this app, so that Worker stays pinned at the 404 stub forever. Nothing in `ci/` is task runtime — root `CLAUDE.md` §6's "no `src/` here" rule still holds.

### Manual escape hatch

```bash
pnpm --filter @baseout/workflows run deploy:staging      # or deploy:production
```

Requires `TRIGGER_ACCESS_TOKEN` in the environment (or a prior `npx trigger.dev@4.5.7 login`).

## Layout

```
trigger/
  tasks/
    _ping.ts            Smoke task — proves the Worker → Trigger.dev wire
    backup-base.task.ts Trigger.dev wrapper around runBackupBase
    backup-base.ts      Pure orchestration (testable without SDK)
    _lib/
      airtable-client.ts    Airtable Metadata + Records API client
      csv-stream.ts         Page → CSV transformer
      field-normalizer.ts   Airtable field value → CSV cell normaliser
      local-fs-write.ts     Local-disk CSV writer (R2 replacement)
      r2-path.ts            Backup-tree path layout (legacy name)
trigger.config.ts       Trigger.dev project config
tests/                  Plain Vitest tests
```

## Cross-app contract with apps/server

The Worker enqueues via `tasks.trigger<typeof X>("X-id", payload)`. Type definitions for the task functions are exported from this package so the Worker gets payload typing without bundling the task body. After a task completes, the task POSTs `/api/internal/runs/:runId/{progress,complete}` back to the engine — body shape stable across the boundary.

## Runtime

Node only. The tasks read configuration from `process.env`:

- `BACKUP_ENGINE_URL` — the apps/server hostname. For the local loop (the default for `pnpm dev`), point at the local engine over loopback: `http://localhost:8787` (see `shared/internal/ops-setup.md` §7.4). Deployed engine: `https://baseout-server.openside.workers.dev` (run web with `pnpm dev:remote`).
- `INTERNAL_TOKEN` — service-token; byte-equal to apps/server's value (a throwaway local value in the local loop, never the deployed token)
- `AIRTABLE_*`, R2 / BYOS provider secrets — set in Trigger.dev's environment variables UI per env (R2 left blank locally → backups write to `apps/workflows/.backups/`)

## Why this is its own app

Trigger.dev tasks deploy on Trigger.dev's runner, with their own bundle, retry semantics, and runtime constraints (Node, no workerd globals). Co-locating them in `apps/server` made the Cloudflare Worker source tree confusing (which files run in workerd, which in Node). Extracting them mirrors the deployment topology: one workspace package per deploy target.
