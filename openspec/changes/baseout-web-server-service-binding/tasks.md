## 1. Verify preconditions

- [ ] 1.1 Confirm `apps/web/src/lib/backup-engine.ts` has exactly **one** caller in the codebase: `grep -rn 'createBackupEngine\|BACKUP_ENGINE_URL' apps/ packages/ scripts/`. Expected: only [apps/web/src/pages/api/connections/airtable/test.ts](../../../apps/web/src/pages/api/connections/airtable/test.ts) and the test file. If anything else surfaces, add it to the refactor list before continuing.
- [ ] 1.2 Confirm wrangler version supports `services[]` bindings on the version pinned in [apps/web/package.json](../../../apps/web/package.json). Today's `wrangler ^4.61.1` does. Re-verify with `pnpm --filter @baseout/web exec wrangler --version` if upgrading wrangler is on the menu.
- [ ] 1.3 Confirm Cloudflare account has `services` quota — service bindings are unlimited on Workers Paid; Free plan caps at 1 binding. Account is on Workers Paid per [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md). Re-confirm by running `pnpm --filter @baseout/server exec wrangler whoami`.
- [ ] 1.4 Read the latest Cloudflare service-bindings docs via `npx ctx7@latest library cloudflare-workers "service bindings wrangler.jsonc"` then `npx ctx7@latest docs <id> "service bindings declaration in wrangler.jsonc and dev mode resolution"`. Confirm the syntax in [design.md](./design.md) §Wrangler Config matches current docs; flag deltas before editing config.

## 2. Add the dev deploy target on apps/server

- [x] 2.1 Edit [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example) (the rendered `wrangler.jsonc` is gitignored as of the prior `template wrangler.jsonc` refactor): add an `env.dev` block above `env.staging`. Worker name `baseout-server-dev`. Reuse the existing dev Hyperdrive `id` (`ba2652f40f864918a2da0849f24d12a2`) with `localConnectionString: "{{DATABASE_URL}}"`. **Note:** wrangler does NOT inherit `durable_objects` either (only `migrations` stays top-level), so redeclared `CONNECTION_DO` + `SPACE_DO` bindings inside `env.dev`. Updated the inheritance comment block accordingly. `wrangler deploy --env dev --dry-run` resolves all three bindings warning-free.
- [x] 2.2 Added `deploy:dev` script to [apps/server/package.json](../../../apps/server/package.json): renders the wrangler config first (matches the existing `deploy` script shape) then runs `wrangler deploy --env dev`.
- [ ] 2.3 Set the secrets on `baseout-server-dev`: `wrangler secret put INTERNAL_TOKEN --env dev`, `wrangler secret put BASEOUT_ENCRYPTION_KEY --env dev`, `wrangler secret put DATABASE_URL --env dev`. Values must match what `apps/web` uses for the same env. (Pull from existing dev secrets in 1Password / team vault — do not paste into this task list.)
- [ ] 2.4 Deploy: `pnpm --filter @baseout/server deploy:dev`. Confirm `baseout-server-dev.openside.workers.dev` returns 401 unauthorized on `curl -X POST .../api/internal/ping` (proves the middleware gate is live) and 200 on `curl .../api/health`.

## 3. Declare the service binding on apps/web

- [x] 3.1 Edit [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example): added top-level `services` block declaring `BACKUP_ENGINE` → `baseout-server-dev`. Updated the inheritance comment block to include `services` (and `durable_objects`, which had the same gotcha on the apps/server side).
- [x] 3.2 ~~Add `services` blocks to `env.staging` and `env.production`.~~ **Deferred to follow-up openspec change** per agreement: those Workers (`baseout-server-staging`, `baseout-server`) aren't deployed yet; declaring the binding now would fail-resolve at deploy. Will land alongside staging/prod Hyperdrive + KV provisioning.
- [x] 3.3 Ran `pnpm --filter @baseout/web cf-typegen`. `worker-configuration.d.ts` now declares `BACKUP_ENGINE?: Fetcher /* baseout-server-dev */` on the dev `Env`. **Note:** wrangler types marks bindings as optional even when non-optional in config; the runtime `if (!env.BACKUP_ENGINE) ...` guard in test.ts (task 5.1) covers it.
- [x] 3.4 Edited [apps/web/src/env.d.ts](../../../apps/web/src/env.d.ts) `ProvidedEnv` — removed `BACKUP_ENGINE_URL`, added `BACKUP_ENGINE: Fetcher` as a fallback declaration (in case generated types are stale). `BACKUP_ENGINE_INTERNAL_TOKEN` retained.

## 4. Refactor the engine client

- [x] 4.1 Updated [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts): `BackupEngineOptions` now `{ binding: Fetcher, internalToken: string }` (dropped `url` + `fetchImpl`). `createBackupEngine` uses `options.binding.fetch('https://engine' + path, init)`. Header rewritten to describe the service-binding transport. `EngineWhoamiResult`, `EngineWhoamiSuccess`, `EngineWhoamiError`, `KNOWN_ERROR_CODES` unchanged.
- [x] 4.2 Rewrote [apps/web/src/lib/backup-engine.test.ts](../../../apps/web/src/lib/backup-engine.test.ts) with `fetcherStub(handler)` helper returning `{ fetch: vi.fn(...) }` shape. All 10 tests rewired from `fetchImpl` → `binding`. Dropped "handles trailing slash on the base URL" (URL-resolution no longer applies); replaced with "passes the connection_id through encodeURIComponent on the path" (the canonical-path invariant the binding now enforces). 10/10 green.

## 5. Update the route to use the binding

- [x] 5.1 Updated [apps/web/src/pages/api/connections/airtable/test.ts](../../../apps/web/src/pages/api/connections/airtable/test.ts): dropped the `workerEnv` cast for `BACKUP_ENGINE_URL`; reads `env.BACKUP_ENGINE` directly. `server_misconfigured` early-return now checks both the binding AND the token (the binding is required because `wrangler types` marks it as optional — the runtime guard doubles as the type narrow). `createBackupEngine({ binding, internalToken })` per the new shape.
- [x] 5.2 `pnpm --filter @baseout/web typecheck` — 0 errors.
- [x] 5.3 `pnpm --filter @baseout/web exec vitest run src/pages/api/connections/airtable/test.spec.ts` — 10/10 green (no logic change; helper untouched).

## 6. Trim the env config

- [ ] 6.1 Edit [apps/web/.dev.vars.example](../../../apps/web/.dev.vars.example): delete the `BACKUP_ENGINE_URL=...` line and the comment block that introduces it. Keep `BACKUP_ENGINE_INTERNAL_TOKEN`. Add a new comment block above the token noting "the engine is reached via the BACKUP_ENGINE service binding declared in wrangler.jsonc; this token is the defense-in-depth header sent on every binding fetch and must equal apps/server's INTERNAL_TOKEN."
- [ ] 6.2 Tell the developer running this change to manually delete the `BACKUP_ENGINE_URL=...` line from their local `apps/web/.dev.vars` (gitignored). Note: do not commit `.dev.vars`.
- [ ] 6.3 Confirm there are no other references to `BACKUP_ENGINE_URL` left in the repo: `grep -rn BACKUP_ENGINE_URL .` (excluding the proposal/design/tasks files in this change directory and the openspec change archive).

## 7. Document the dev workflow

- [ ] 7.1 Add a "Local dev: deploying baseout-server-dev" subsection to [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md). Cover:
  - One-time `pnpm --filter @baseout/server deploy:dev` precondition.
  - When to redeploy (anytime apps/server changes that touch the dev test path).
  - How to verify the binding is healthy (curl the engine's `/api/health` directly via `https://baseout-server-dev.openside.workers.dev/api/health`, then click Test connection from `/integrations` to verify the binding path works end-to-end).
- [ ] 7.2 Update CLAUDE.md §5.2 "Backend Surface Contract" if the wording around "frontend calls these to enqueue work" needs to clarify that calls now arrive via service binding rather than HTTP+token. Likely a one-line tweak; keep the rest of the section intact.

## 8. End-to-end verification

- [ ] 8.1 Stop both dev workers. Restart `pnpm --filter @baseout/web dev`.
- [ ] 8.2 Open `https://localhost:4331/integrations`. The Airtable card should still render `Connected`. Click **Test connection**.
- [ ] 8.3 Expected outcomes:
  - **Success path:** spinner → "Connected. Airtable user: …" green status. Means the binding works end-to-end and the row's stored token is still valid.
  - **`airtable_token_rejected`:** "Airtable rejected the stored token. Reconnect Airtable." Means the binding works; the token expired (60-min Airtable TTL). Re-connect Airtable to verify the success path.
  - **`engine_unreachable` / 503:** the binding resolved but `baseout-server-dev` is down. Re-deploy via `pnpm --filter @baseout/server deploy:dev` and retry.
  - **`unauthorized` / 502:** binding resolved but token mismatch. `wrangler secret put INTERNAL_TOKEN --env dev` on apps/server, ensure it equals apps/web's `BACKUP_ENGINE_INTERNAL_TOKEN`.
  - **403 from anywhere in the stack:** the binding did NOT resolve. Check wrangler.jsonc syntax, redeploy apps/web. Should not occur after this change — was the symptom this change exists to remove.
- [ ] 8.4 Confirm the network tab shows `POST /api/connections/airtable/test` returning the appropriate status (200 / 409 / 503 — not 502 with `engine_error`).

## 9. Production-readiness gate

- [ ] 9.1 Before the next staging or production deploy of `apps/web` after this change merges: confirm `apps/server` has been deployed to the same env at least once. Run `pnpm --filter @baseout/server exec wrangler deployments list --env <env>` to verify. If absent, deploy apps/server first.
- [ ] 9.2 Add a one-line check to the deploy runbook in [shared/internal/](../../../shared/internal/) — "Before deploying apps/web to a new env, ensure apps/server is deployed in that env (service binding requires it)."

## 10. Cleanup

- [ ] 10.1 Once 8.3 success path is confirmed in dev, archive this change via `/opsx:archive baseout-web-server-service-binding`.
- [ ] 10.2 If there are any leftover references to `BACKUP_ENGINE_URL` in deployed Cloudflare secrets across envs (`wrangler secret list --env dev|staging|production`), delete them: `wrangler secret delete BACKUP_ENGINE_URL --env <env>`. Optional but tidy.
