# system-workflows-cf-builds — tasks

No runtime behavior ships (no task body, no payload shape, no orchestration), so there is no red-green TDD loop per `CLAUDE.md` §3.4. The verification gate is `pnpm --filter @baseout/workflows run build` green plus the existing test suite unchanged. §4 is dashboard-only and needs Dan's account access.

## 1. Anchor Worker

- [x] 1.1 Add `apps/workflows/ci/worker-stub.ts` — a 404 handler, no `cloudflare:workers` import, no workerd globals beyond the bare fetch signature. Header comment states it is not runtime, why it exists, and the one-time bootstrap command. — _Named `ci/` not `src/` per design D2, so `CLAUDE.md` §6's "no `src/` here" stays literally true._
- [x] 1.2 Add `apps/workflows/wrangler.jsonc` — name `baseout-workflows`, `main` → the stub, `compatibility_date` matching `apps/server` (`2026-04-22`), `workers_dev: false`, `observability: false`. No bindings, no vars, no `env` blocks (design D3). Committed, not gitignored — matches `apps/server`, `apps/admin`, `apps/web`.
- [x] 1.3 Add `wrangler ^4.124.0` to `devDependencies` (pinned to match `apps/server`) so the `$schema` ref resolves and the one-time bootstrap deploy is reproducible. — _Resolved 4.124.0; dev-only, never runs in this app's CI._

## 2. Build + deploy scripts

- [x] 2.1 Add `build:deps` = `pnpm --filter "@baseout/workflows^..." run build` (mirrors `apps/server`) and `build` = `build:deps && typecheck` (design D4). — _`@baseout/shared` resolves via `./dist/*`, so the deps build is mandatory, not hygiene._
- [x] 2.2 Add `deploy:staging` = `npx trigger.dev@4.5.7 deploy --env staging` and `deploy:production` = `npx trigger.dev@4.5.7 deploy --env prod`. CLI version stays pinned to the SDK version, matching the existing `dev` / `deploy` scripts. Bare `deploy` left untouched (§3.2).
- [x] 2.3 Add `ci/**/*` to the `tsconfig.json` `include` so the stub is typechecked and cannot rot. — _Verified `Response` resolves under `lib: ES2022` + `types: ["node"]` with no extra lib._
- [x] 2.4 Verify `pnpm --filter @baseout/workflows run build` green. — _2026-09-03: `packages/shared` + `packages/db-schema` tsup builds succeeded, `tsc --noEmit` clean._

## 3. Documentation

- [x] 3.1 `apps/workflows/README.md` — new "Deploy" section: the two Workers Builds commands, the full build-trigger settings table, the build-variables table with rationale, the anchor-Worker bootstrap, and the manual escape hatch.
- [x] 3.2 `shared/internal/cloudflare-env-separation.md` §8 — the Workers Builds source-of-truth entry, including the false-premise correction (there was never a GitHub Actions deploy) and the `PNPM_VERSION` trap flagged for audit against the other three triggers.
- [x] 3.3 Root `CLAUDE.md` §6 — two new bullets (deploy pipeline; the anchor Worker is not a runtime) plus `ci/` + `wrangler.jsonc` in the file-layout block, with the "no `src/`" sentence amended rather than contradicted.

## 4. Dashboard configuration — BLOCKED on account access (Dan)

- [ ] 4.1 One-time per account: `pnpm --filter @baseout/workflows exec wrangler deploy` to create the `baseout-workflows` Worker record. Expect it to sit at that version permanently — a never-redeployed Worker here is correct, not a failed build.
- [ ] 4.2 Staging account: connect the repo to `baseout-workflows`; root dir `apps/workflows`; build `pnpm run build`; deploy `pnpm run deploy:staging`; `branch_includes: ["staging"]`; watch paths `apps/workflows/**`, `packages/shared/**`, `packages/db-schema/**`, `pnpm-lock.yaml`.
- [ ] 4.3 Production account: same, with deploy `pnpm run deploy:production` and `branch_includes: ["main"]`.
- [ ] 4.4 Set build variables on **both** triggers: `TRIGGER_ACCESS_TOKEN` (secret, `tr_pat_…` from Trigger.dev → profile → Personal Access Tokens), `PNPM_VERSION=11.1.1`, `NODE_VERSION=22.23.2`. Do **not** add the access token to any `.dev.vars` (design D6).
- [ ] 4.5 Smoke: push a no-op comment change under `apps/workflows/` to `staging`; confirm the build log shows the deps build, a clean `tsc`, and a Trigger.dev deployment landing in the **staging** environment of `proj_lklmptmrmrkeaszrmhcs` — not `prod`.
- [ ] 4.6 Confirm a change *outside* the watch paths does not trigger a workflows build.

## 5. Post-ship — lat.md graph

Per `CLAUDE.md` §3.7 the graph records how the system **currently** works and is updated *after* a change ships. §4 is not done, so the deploy topology is not yet true.

- [x] 5.1 Correct the stale `pnpm@9.12.0` claim in `lat.md/monorepo-layout.md` (prose + Toolchain table), `lat.md/tech-stack.md`, and root `CLAUDE.md` §2 — the pin has been `pnpm@11.1.1` since the 9→11 upgrade. Not a drive-by: this stale fact is exactly what makes the `PNPM_VERSION` trap (design D5) invisible, so the Toolchain row now states *why* 11 is load-bearing.
- [ ] 5.2 After §4 lands: add a Deployment section to `lat.md/monorepo-layout.md` recording that every app deploys via Workers Builds, that `apps/workflows` is the one whose deploy command targets Trigger.dev rather than wrangler, and that `baseout-workflows` is a build anchor with no traffic.

## 6. Follow-up — reported, not fixed here

- [ ] 6.1 Audit the live `baseout-web` / `baseout-server` / `baseout-admin` build triggers for `PNPM_VERSION=11.1.1`. Without it they install under pnpm 10.11.1, which ignores `pnpm-workspace.yaml`'s `allowBuilds` / `minimumReleaseAgeExclude` and can drop the `overrides` block that carries the `system-dep-remediation` CVE pins — a green build with known-high CVEs restored (design D5). Own change; three live pipelines.
- [ ] 6.2 Decide whether the vestigial `apps/web/.github/workflows/{ci,e2e-staging,promote-prod}.yml` should be deleted. GitHub reads only the repo-root `.github/`, so they have never run in this repo, but they read as live CI and are what made this change's original premise look true. Deleting `promote-prod.yml` / `e2e-staging.yml` loses recipes worth keeping somewhere — hence a decision, not a cleanup.
