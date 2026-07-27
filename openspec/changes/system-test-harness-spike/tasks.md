# system-test-harness-spike — Tasks

## 0. Spike (gates everything)

- [x] 0.1 Confirm `createTestHarness` version floor: bump `wrangler` in `apps/web` (dev-only), inspect the installed types/exports for the actual API surface (config options, worker-array shape, service-binding resolution, methods). → **floor is 4.112.0** (API present pre-announcement; clears the 7-day `minimumReleaseAge` gate)
- [x] 0.2 Boot the **server** Worker under the harness: `wrangler.test.jsonc` reused as-is, DO bindings (`CONNECTION_DO`/`SPACE_DO`) mount and execute (real /token decrypt). *(Folded into 0.3 — booted both workers together on the first run.)*
- [x] 0.3 Consumer Worker (wrapping the REAL `createBackupEngine` from apps/web src — full Astro build deferred, see README) with `services: BACKUP_ENGINE` resolving to the harness's server worker; whoami driven end-to-end. Cross-worker binding resolution WORKS (by config `name`; `bindingOverrides` also available).
- [x] 0.4 **MSW** intercepts the server's outbound Airtable call — after working around an upstream header-drop bug (foreign `_Request` init → MSW normalizes headers to `{}`); shim + root cause in README. `authorization` header asserted end-to-end.
- [x] 0.5 Postgres: no Docker on this machine → embedded PostgreSQL 16 fallback in the harness globalSetup (delegates to the integration setup for schema+migrations). Plain `DATABASE_URL` var works from workerd; Hyperdrive `localConnectionString` left unexercised (web-Worker increment).

## 1. Report

- [x] 1.1 Findings in `README.md`: verdict ADOPT (bounded), version floor, upstream MSW bug + shim, adoption order (engine-contract tests → local Playwright → MSW migration). `reset()` semantics vs `resetBaseoutTables()` untested — noted for the follow-up change.
- [x] 1.2 Regression: web unit 1303 green, web build green, targeted server whoami green; astro-check/lint failures attributed to the concurrent auth session (0 from this change); `connection-do-token-cache` failures pre-existing.
- [ ] 1.3 Surface smoke command for human approval; commit locally (no PR/push) per house loop.
