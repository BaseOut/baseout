# system-test-harness-spike — Proposal

## Why

Cloudflare shipped a supported integration-test API in Wrangler ([changelog 2026-07-21](https://developers.cloudflare.com/changelog/post/2026-07-21-integration-test-harness/)): `createTestHarness()` boots one or more Workers as real local servers from their wrangler configs, usable from any Node test runner, with multi-Worker request routing, MSW-compatible outbound-fetch mocking, storage `reset()`, and log inspection. It replaces the deprecated `unstable_startWorker()` / `unstable_dev()` (which this repo never adopted — adoption is purely additive).

It targets three documented gaps in our test story:

1. **No cross-Worker test exists.** The `BACKUP_ENGINE` service binding (web → server) is only ever a `vi.fn()` stub (`apps/web/src/lib/backup-engine.test.ts`); the server's `/api/internal/*` routes are tested for routing/auth/validation only in a deliberately no-Postgres pool-workers isolate. Every real web→server path is deferred to deployed smoke scripts.
2. **"Must deploy to test."** Playwright hard-requires `E2E_TARGET_URL` pointing at a deployed worker (`apps/web/playwright.config.ts` throws without it).
3. **MSW is mandated but unused.** CLAUDE.md §3.4 requires HTTP-boundary mocking with msw; `msw@^2.13.4` is installed in apps/web with zero usage — all outbound mocking is hand-rolled `fetchImpl` DI stubs, and several tests carry `TODO(... msw-mocked Airtable/Stripe)` markers.

## What Changes

Spike only — no production code, no CI wiring, no broad adoption:

- Bump `wrangler` devDependency in the spike workspace to the harness-capable version (confirm the exact floor; latest is 4.114.0 vs our pinned `^4.61.1`).
- One timeboxed spike test proving the single scenario nothing can test today: `createTestHarness()` boots **both** the web and server Workers from (derived) test configs, a request driven through web's real `BACKUP_ENGINE` service binding reaches the server's `/api/internal/*`, with MSW intercepting the server's outbound Airtable call.
- Findings (works / blockers, version floor, recommended adoption order) recorded in this change's `README.md`, mirroring the `server-mcp-workspaces` spike pattern.

**STOP conditions (valid spike outcomes):** service-binding resolution between harness workers doesn't work; DO (`CONNECTION_DO`/`SPACE_DO`) or Hyperdrive bindings unsupported under the harness; version floor forces an incompatible toolchain bump. Record and stop — don't build around.

## What it does NOT solve

The server test pool has no Postgres by design — a harness-booted server Worker still needs the Dockerized test DB (web integration already has this via `docker-compose.test.yml` + Hyperdrive `localConnectionString`). The existing pool-workers suites (fine-grained DO testing via `runInDurableObject`) stay — the harness is coarser-grained and additive, not a replacement for `@cloudflare/vitest-pool-workers`.

## Impact

- **Apps:** `apps/web` (spike test file + own vitest config, excluded from existing suites; wrangler devDep bump), reads `apps/server`'s build output/config to boot it — no `apps/server` source changes.
- **system-\* prefix rationale:** test-infra tooling evaluation, no runtime code (per CLAUDE.md §3.6).
- **Follow-ups if green** (filed per-app, not in this change): cross-Worker binding tests, local Playwright target, MSW adoption for the TODO'd happy paths.
