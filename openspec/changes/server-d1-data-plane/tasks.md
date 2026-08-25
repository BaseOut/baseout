# server-d1-data-plane — tasks

TDD per CLAUDE.md §3.4. The d1 I/O module tests execute against a REAL local D1 (miniflare `TEST_D1` binding — actual D1 semantics, not just SQLite) with the real bundled `SPACE_SQLITE_DDL` — no mocks on the SQL plane.

## 1. D1 space-db I/O

- [x] 1.1 Test harness: `SpaceD1Executor` adapter over the miniflare `TEST_D1` binding (`wrangler.test.jsonc`) + fixture that applies the full bundled DDL (doubles as a DDL-applies-cleanly guard). _Upgraded from the planned node:sqlite — the workers pool provides real D1._
- [x] 1.2 `ensureBaseRun` — select-or-insert, JS-minted UUID; idempotent on retry.
- [x] 1.3 `readSchemaWorkingSet` — PriorWorkingSet shape parity with the pg reader (options JSON-parsed, is_primary → boolean).
- [x] 1.4 `applySchemaDiff` — schema_versions dedupe (ON CONFLICT DO NOTHING on base+hash), base_run stamps, lifecycle insert/seen/removed/unknown upserts, schema_updates rows; re-run converges (idempotency test).
- [x] 1.5 `readAllEntities` — Browse payload parity (field config enrichment, removedAt via first_unseen_run → base_run.completed_at).
- [x] 1.6 View regeneration glue: apply `query-views-sqlite` builders over the executor (records-enabled Spaces only).

## 2. Route dispatch

- [x] 2.1 `resolve.ts` returns `d1DatabaseId` alongside `pgLocator`.
- [x] 2.2 `schema-sync` d1 arm: core diff path; optional sections report `d1_unsupported`; upgrade/inference/AI skipped; pg path byte-identical.
- [x] 2.3 `schema-read` d1 arm: unscoped Browse read; scoped keeps 501 (`d1_scoped_unsupported`).

## 3. Verification

- [x] 3.1 Targeted suites + apps/server tsc green.
- [ ] 3.2 Token-day smoke (extends server-d1-backend 6.1): provision d1 Space → schema-only backup → schema-sync 200 → schema-read returns the tree → deprovision. Log here with date + Space id. _Blocked on CLOUDFLARE_D1_API_TOKEN (Dan-requests item 4). Runner ready: `apps/server/scripts/smoke-d1.mjs`._
