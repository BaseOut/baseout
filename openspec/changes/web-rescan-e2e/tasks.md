# Implementation tasks

## 1. Master DB schema + migration

- [x] 1.1 Define `e2e_pending_airtable_bases (space_id TEXT FK→spaces.id ON DELETE CASCADE, at_base_id TEXT, name TEXT, UNIQUE (space_id, at_base_id))`. **Deviation from proposal:** the table lives inline in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) (lines 480-488) alongside the rest of `baseout.*` rather than in a dedicated file — drizzle-kit's config (`schema: ['./src/db/schema/auth.ts', './src/db/schema/core.ts']`) only scans those two files, so a new schema file would be invisible. The barrel already re-exports core. Functionally equivalent.
- [x] 1.2 No additional barrel work needed — `apps/web/src/db/schema/index.ts` already re-exports `./core`.
- [x] 1.3 Migration generated: [apps/web/drizzle/0009_e2e_pending_airtable_bases.sql](../../../apps/web/drizzle/0009_e2e_pending_airtable_bases.sql) via `pnpm --filter @baseout/web exec drizzle-kit generate --name e2e_pending_airtable_bases`
- [x] 1.4 `pnpm --filter @baseout/web db:migrate` — applied to dev DB
- [x] 1.5 `pnpm --filter @baseout/web db:check` — journal in sync

## 2. Engine mirror

- [x] 2.1 [apps/server/src/db/schema/e2e-pending-airtable-bases.ts](../../../apps/server/src/db/schema/e2e-pending-airtable-bases.ts) — mirror file with header comment naming the canonical migration in apps/web
- [x] 2.2 Exported from `apps/server/src/db/schema/index.ts` barrel

## 3. Seed endpoint (apps/web)

- [x] 3.1 [apps/web/src/pages/api/internal/test/seed-workspace-rediscovery.ts](../../../apps/web/src/pages/api/internal/test/seed-workspace-rediscovery.ts) — POST + extracted `handleSeedWorkspaceRediscovery`; three-guard pattern (build / HMAC / input) mirrored from `seed-backup-happy-path`.
- [x] 3.2 `email` + `scenario` query params; scenario whitelisted to `discover_only` | `auto_add` | `tier_cap`.
- [x] 3.3 Idempotent: reuses user/org/space/connection chain; resets `backup_configuration_bases`, stub `at_bases`, and `e2e_pending_airtable_bases` per call.
- [x] 3.4 Seeds: user, org, membership, space, space_platforms, user_preferences, connection (`status='active'`, stub `accessTokenEnc='e2e-stub-token'`), per-scenario baseline `at_bases` + included `backup_configuration_bases` (0 / 1 / 5), `backup_configurations` with `autoAddFutureBases` per scenario, `e2e_pending_airtable_bases` populated with baseline + 1 pending. Stub Airtable IDs derived from `spaceId` to avoid cross-user collisions in the orchestrator's spaceId-unscoped `atBaseId → at_bases.id` SELECT.
- [x] 3.5 Returns `{ userId, organizationId, spaceId, configurationId, pendingAtBaseIds: [pendingStubId] }`.
- [x] 3.6 Unit test [seed-workspace-rediscovery.test.ts](../../../apps/web/src/pages/api/internal/test/seed-workspace-rediscovery.test.ts) — 10 tests covering all three guards (build, HMAC, input + scenario whitelist). Per-scenario data invariants are verified end-to-end by the Playwright spec (§5) against a real DB; the seed file's row-shape correctness is read off the live db, not from mock assertions.

## 4. Engine E2E branch (apps/server)

- [x] 4.1 [apps/server/src/lib/rediscovery/run-deps.ts](../../../apps/server/src/lib/rediscovery/run-deps.ts) — added `e2eTestMode?: boolean` to `BuildRediscoveryDepsInput`; when true the resolved deps' `listAirtableBases` reads from `e2e_pending_airtable_bases` via the exported `listE2EPendingBases(db, spaceId)` helper and the function skips `decryptToken` (stub token is not decryptable).
- [x] 4.2 `spaceId` was already on `BuildRediscoveryDepsInput`; the E2E branch passes it through to `listE2EPendingBases`.
- [x] 4.3 Decision: leave the row in `e2e_pending_airtable_bases` after rescan. Re-running the rescan re-upserts known bases (per `runWorkspaceRediscovery`) without re-discovering, which is the right idempotency behaviour for the test fixture.
- [x] 4.4 [apps/server/tests/integration/rediscovery-e2e-mode.test.ts](../../../apps/server/tests/integration/rediscovery-e2e-mode.test.ts) — 3 tests pinning `listE2EPendingBases`'s table + mapping + single-call chain shape using a thin Drizzle stub. Route-level happy path stays end-to-end via the Playwright spec.
- [x] 4.5 (Out-of-band but required) `apps/server/src/env.d.ts` — added optional `E2E_TEST_MODE?: string` to the `Env` interface. The rescan handler at [apps/server/src/pages/api/internal/spaces/rescan-bases.ts](../../../apps/server/src/pages/api/internal/spaces/rescan-bases.ts) now passes `e2eTestMode: env.E2E_TEST_MODE === "true"` into `buildRediscoveryDeps`.

## 5. Playwright spec (apps/web)

- [x] 5.1 [apps/web/tests/e2e/workspace-rediscovery.spec.ts](../../../apps/web/tests/e2e/workspace-rediscovery.spec.ts) — `test.describe('workspace rediscovery — manual rescan UI flow')` with three tests.
- [x] 5.2 Reuses the magic-link inbox pattern from [backup-happy-path.spec.ts](../../../apps/web/tests/e2e/backup-happy-path.spec.ts) (explicit `pollMagicLink(mintedSince)` instead of the shared 2s-window fixture) via a `seedAndSignIn` helper.
- [x] 5.3 `discover_only` — banner shows "1 new base discovered…", no auto-added / blocked copy, Dismiss button hides the banner.
- [x] 5.4 `auto_add` — banner shows "1 auto-added to your backups."; selection form contains a row matching "New Base From Workspace" whose `[data-base-checkbox]` is checked. (No `data-auto-discovered` marker exists in the UI today — proposal called this out as "or equivalent"; the checked-state assertion is the equivalent.)
- [x] 5.5 `tier_cap` — banner shows "1 not included — you're at your tier limit"; the new base is visible in the selection form (rediscovery upserts the at_base row even when blocked) but its checkbox is NOT checked.

## 6. Verification

- [x] 6.1 `pnpm --filter @baseout/web typecheck` — 0 errors / 4 pre-existing hints.
- [x] 6.2 `pnpm --filter @baseout/server typecheck` — pass.
- [x] 6.3 `pnpm --filter @baseout/web exec vitest run seed-workspace-rediscovery` — 10/10 green.
- [x] 6.4 `pnpm --filter @baseout/server test rediscovery` — 12/12 green (9 pre-existing + 3 new).
- [ ] 6.5 User deploys engine to dev: `pnpm --filter @baseout/server deploy:dev`. Pre-deploy, set `E2E_TEST_MODE=true` on the dev Worker (via `wrangler.jsonc` `env.dev.vars` or `wrangler secret put E2E_TEST_MODE` — the engine reads `env.E2E_TEST_MODE`).
- [ ] 6.6 User runs `pnpm --filter @baseout/web test:e2e workspace-rediscovery` with `E2E_TARGET_URL` and `E2E_TEST_TOKEN` exported — all 3 tests green.
- [ ] 6.7 On approval: tick the 2 smoke tasks in `openspec/changes/web-workspace-rediscovery/tasks.md` with a pointer to this spec, then `/opsx:archive web-workspace-rediscovery`.
