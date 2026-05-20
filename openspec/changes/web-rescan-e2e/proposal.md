## Why

`web-workspace-rediscovery` ships with 2 unchecked manual-smoke tasks ("rescan happy path + dismiss + auto-add"; "tier-cap edge case"). The orchestrator logic is already covered by integration tests under `apps/server/tests/integration/`, but the **UI wiring** — rescan button → banner copy → dismiss → toggle persistence → blocked-by-tier rendering — has no automated coverage.

Playwright is the project's e2e harness (per [apps/web/playwright.config.ts](../../../apps/web/playwright.config.ts) + existing specs `magic-link.spec.ts`, `backup-happy-path.spec.ts`). This change adds an automated Playwright spec for the rescan flow so the 2 unchecked smoke tasks in `web-workspace-rediscovery` can close, and so the regression surface is locked in for future rescan changes.

The rescan flow calls Airtable in production. For e2e determinism, the engine needs an `E2E_TEST_MODE`-gated branch where `listAirtableBases()` returns a deterministic stub list seeded by the test harness — mirroring the pattern in `seed-backup-happy-path` (stub OAuth tokens) and `last-verification` (test-only magic-link readback).

## What Changes

- **New master-DB table** `e2e_pending_airtable_bases (space_id, at_base_id, name)` — holds the "Airtable workspace listing" the engine reads in E2E mode. Migration owned by `apps/web/drizzle/`, mirror declared in `apps/server/src/db/schema/`.
- **New apps/web seed endpoint** `POST /api/internal/test/seed-workspace-rediscovery?email=e2e-…&scenario=<name>` — three-guard pattern (build / HMAC / input) matching `seed-backup-happy-path`. Seeds user + org + space + active Airtable connection + initial `at_bases` rows + pending-base rows per scenario:
  - `discover_only` — 1 pending base, auto-add toggle OFF
  - `auto_add` — 1 pending base, auto-add toggle ON, included count 1 (well under cap)
  - `tier_cap` — 1 pending base, auto-add toggle ON, included count == Starter cap (5)
- **New apps/server branch** in `buildRediscoveryDeps`: when `env.E2E_TEST_MODE === 'true'`, `listAirtableBases` reads from `e2e_pending_airtable_bases` for the call's spaceId instead of calling Airtable. Production code path unchanged when the flag is unset.
- **New Playwright spec** `apps/web/tests/e2e/workspace-rediscovery.spec.ts` — three tests, one per scenario above. Each: seed → sign in via existing magic-link fixture → `/integrations` → click Rescan → assert banner copy → for `auto_add`, verify the new base shows in the "Bases included" list → for `tier_cap`, verify the banner shows `blocked by tier` and the new base does NOT show as included.
- **Tasks ticked in `web-workspace-rediscovery`** when this change ships: the 2 unchecked smoke tasks get re-pointed to "covered by Playwright spec workspace-rediscovery.spec.ts" and the change archives.

## Out of Scope

- Replacing real Airtable behavior with the stub in production paths. The branch is strictly gated on `E2E_TEST_MODE === 'true'`.
- Stubbing `getBaseSchema` or `listRecords` — only `listBases` is needed for rescan. Other endpoints stay live.
- Storage destination (BYOS) Connect flow seeding — out of scope; the rescan flow only needs Airtable.
- Sharing the seed endpoint between rescan and backup-happy-path. They have distinct setup needs; consolidation waits for a third caller (YAGNI).
- Engine deploy automation. The user runs `pnpm --filter @baseout/server deploy:dev` manually after engine code lands.

## Capabilities

### Modified Capability

- `backup-workspace-rediscovery` — gains an `E2E_TEST_MODE` data-source branch on `listAirtableBases` that reads from `e2e_pending_airtable_bases` instead of Airtable's Meta API. The orchestrator and policy logic are unchanged.

### New Capability

- `web-rescan-e2e` — Playwright coverage for the manual rescan flow's three customer-facing branches (discover-only, auto-add success, blocked-by-tier).

## Impact

- **Master DB schema**: one new table. Migration generated via `pnpm db:generate`, applied via `pnpm db:migrate`.
- **apps/web**: new seed endpoint + unit test + Playwright spec. No production-route changes.
- **apps/server**: one branch in `buildRediscoveryDeps` keyed on `E2E_TEST_MODE`. No other production-route changes.
- **Secrets**: reuses existing `E2E_TEST_MODE` (boolean) + `E2E_TEST_TOKEN` (HMAC secret) already wired for `seed-backup-happy-path`. No new secrets.
- **Engine deploy**: required to pick up the new `listAirtableBases` branch (`pnpm --filter @baseout/server deploy:dev`).
- **CI**: same e2e workflow (`.github/workflows/e2e-staging.yml`) picks up the new spec automatically.

## Reversibility

Pure roll-forward. To disable the e2e path: leave `E2E_TEST_MODE` unset (default in prod), and the engine never enters the stub branch. The `e2e_pending_airtable_bases` table stays empty in prod; the seed endpoint and Playwright spec are gated behind `E2E_TEST_MODE` so they're inert.
