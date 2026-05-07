## 1. Pre-requisites (verify before starting)

- [ ] 1.1 Confirm staging Hyperdrive exists or provision via `wrangler hyperdrive create baseout-server-staging --connection-string="$STAGING_DATABASE_URL"`. Capture the returned ID.
- [ ] 1.2 Confirm production Hyperdrive exists or provision via `wrangler hyperdrive create baseout-server-prod --connection-string="$PROD_DATABASE_URL"`. Capture the returned ID.
- [ ] 1.3 Confirm `wrangler whoami` is logged in to the right Cloudflare account for staging deploys (separate accounts per env per [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md) §18.2).

## 2. apps/server staging env

- [ ] 2.1 Edit [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example): expand the `env.staging` block to include `hyperdrive` (with the real staging ID from §1.1) and `durable_objects` (`CONNECTION_DO` + `SPACE_DO`). Mirror the shape of `env.dev`.
- [ ] 2.2 Add a `deploy:staging` script to [apps/server/package.json](../../../apps/server/package.json): `"deploy:staging": "node --env-file-if-exists=.env scripts/launch.mjs deploy && wrangler deploy --env staging"`.
- [ ] 2.3 Set the four required secrets on `baseout-server-staging`:
  - `wrangler secret put INTERNAL_TOKEN --env staging`
  - `wrangler secret put BASEOUT_ENCRYPTION_KEY --env staging`
  - `wrangler secret put DATABASE_URL --env staging`
  - (Once Phase 2 cron lands, add `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_REF`.)
  - `INTERNAL_TOKEN` MUST byte-equal apps/web's `BACKUP_ENGINE_INTERNAL_TOKEN` on staging.
- [ ] 2.4 `pnpm --filter @baseout/server deploy:staging`. Verify with `curl https://baseout-server-staging.openside.workers.dev/api/health` (200) and `curl -X POST .../api/internal/ping` (401).

## 3. apps/server production env

- [ ] 3.1 Repeat §2.1 for `env.production` (use the real prod Hyperdrive ID from §1.2; Worker name `baseout-server`).
- [ ] 3.2 Add `deploy:production` script: `"deploy:production": "node --env-file-if-exists=.env scripts/launch.mjs deploy && wrangler deploy --env production"`.
- [ ] 3.3 Set production secrets (same four as §2.3, but on `--env production`). `INTERNAL_TOKEN` MUST byte-equal apps/web's prod `BACKUP_ENGINE_INTERNAL_TOKEN`.
- [ ] 3.4 `pnpm --filter @baseout/server deploy:production`. Verify health + internal-ping endpoints on the production URL (custom domain if configured).

## 4. apps/web staging service binding

- [ ] 4.1 Edit [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example) `env.staging`: add a `services` block declaring `BACKUP_ENGINE` → `baseout-server-staging`. Mirror the dev shape.
- [ ] 4.2 Render + dry-run: `pnpm --filter @baseout/web exec wrangler deploy --env staging --dry-run`. Expect zero warnings about missing bindings; binding should resolve to the deployed Worker from §2.4.
- [ ] 4.3 `pnpm --filter @baseout/web cf-typegen`. Confirm the staging `Env` interface in `worker-configuration.d.ts` now declares `BACKUP_ENGINE: Fetcher /* baseout-server-staging */`.
- [ ] 4.4 Deploy: `pnpm --filter @baseout/web deploy:staging` (or whatever the staging deploy script is). Hit the Test connection probe on the staging dashboard to verify the binding works end-to-end.

## 5. apps/web production service binding

- [ ] 5.1 Repeat §4.1 for `env.production` (Worker name `baseout-server`).
- [ ] 5.2 Repeat §4.2 dry-run for production.
- [ ] 5.3 Deploy: `pnpm --filter @baseout/web deploy:production`. Test connection probe on production.

## 6. Cleanup

- [ ] 6.1 Delete legacy `BACKUP_ENGINE_URL` secret on apps/web per env: `wrangler secret delete BACKUP_ENGINE_URL --env <dev|staging|production>`. Carries over from the prior change's task §10.2 — optional but tidy. Confirm via `wrangler secret list --env <env>`.
- [ ] 6.2 Update [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md) "Engine — deploy preconditions" subsection: replace the "deferred to follow-up" wording with the realised state (staging + prod bindings now live).
- [ ] 6.3 Archive this change via `/opsx:archive baseout-web-server-service-binding-staging-prod`.

## 7. Roll-back plan (only if a deploy goes sideways)

- [ ] 7.1 If apps/web staging deploy fails because the binding can't resolve: confirm `baseout-server-staging` is actually deployed (`wrangler deployments list --env staging` from `apps/server`). Re-run §2.4 if missing.
- [ ] 7.2 If the binding resolves but probes return 502: token mismatch — re-run `wrangler secret put INTERNAL_TOKEN --env staging` on apps/server with the value from apps/web's `BACKUP_ENGINE_INTERNAL_TOKEN` for the same env.
- [ ] 7.3 If a clean rollback is needed: revert the `services` block addition for that env in `apps/web/wrangler.jsonc.example`, redeploy `apps/web`. Engine-side resources (Hyperdrive, KV) can be left in place — they cost essentially nothing idle.
