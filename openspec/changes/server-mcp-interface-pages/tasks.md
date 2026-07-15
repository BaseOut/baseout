# Tasks

> **Status 2026-07-14:** built (§1–§3, 4.1, 4.3). Remaining: 4.2 deployed smoke
> (human loop — see README.md for the hand-POST recipe). Outcome notes inline.

## 1. Contract + extraction

- [x] 1.1 Define the `interfacePages` schema-sync payload type (`{ capturedAt, raw: { interfaces[], standaloneForms[] } }`) in the engine's schema-sync types — this file is the contract source for `workflows-mcp-interface-pages` task 4.1. → `InterfacePagesCapture` + `parseInterfacePagesField` in [interfaces-sync.ts](../../../apps/server/src/lib/per-space/interfaces-sync.ts).
- [x] 1.2 `src/lib/per-space/interfaces-sync.ts` (pure): `extractInterfaceEntities(raw)` → app/page/form entities (id, name, type, definition) + envelope-tolerant validation (unknown keys pass through; entities without id+name dropped with a count).
- [x] 1.3 Tests (TDD, owner's fixture): extraction shape, standalone-form handling, malformed-entity tolerance. → `tests/integration/per-space/interfaces-sync.test.ts` (32 tests).

## 2. Diff + persistence

- [x] 2.1 `diffInterfaces(prev, next)` (pure): added/removed sets, name deltas, composition deltas (`pageType`, `sourceTableId`, field-id usage incl. `isEditable` flips — ids only, never names/options), capture-hash short-circuit. **Note:** the prior capture hash is RECONSTRUCTED from the stored rows (definitions are refreshed verbatim on every `seen`), so no hash column/migration was needed.
- [x] 2.2 Tests: page add/remove/rename, field-usage delta, rename-echo suppression (schema field rename → zero interface rows), unchanged-hash short-circuit, removal-only-on-successful-capture.
- [x] 2.3 Wire into schema-sync inside `withSpaceSchema`: inserts/updates (`submitted_via='mcp'`), lifecycle stamps, `bo_at_schema_updates` writes with the run association; per-section error isolation (parse/diff failure → `interfaceSync: {ok:false, reason}` on the response, never fails schema sync). **Note:** row-id-targeted writes, NOT upserts — `bo_at_interfaces` has no unique `(base_id, airtable_entity_id)` index until the manual-crud slice ships it. The response gains an `interfaceSync` summary (only when the field was present) so the workflows task can report run progress.
- [x] 2.4 Verify manual-submission rows are untouched by MCP processing. → enforced by `readInterfaceWorkingSet`'s `submitted_via='mcp'` filter + diff ops only ever target row ids it was given (test "never touches rows it was not given"); byte-identical DB assertion lands with the 4.2 smoke (no live-PG harness — see 4.1 note).

## 3. Tier flag + reads

- [x] 3.1 Add `interfaces_enabled` (Growth+ capability resolution) to the run-assembly payload beside the other per-run flags; test both tiers. → `interfacesEnabled` on `BackupBaseTaskPayload`, resolved once per run via `resolveCapabilities` + new `lib/capabilities/interface-backup.ts` (engine-local on purpose — the tier-capabilities MIRROR pair stays byte-identical to web). **Contract note for the workflows change:** `records_enabled` actually travels on the schema-sync RESPONSE, not the task payload — `interfacesEnabled` is on the task payload (the task must know before it decides to call MCP).
- [x] 3.2 Check the existing web Interfaces read path. → **No read path exists anywhere yet** (`web-automations-interfaces-tabs` and the manual-crud slice are both 0-built; nothing reads `bo_at_interfaces`). Nothing to dedupe or gate today; the dedupe-by-`airtable_entity_id` requirement transfers to whichever change builds the first reader (flagged in both changes' proposals as `web-interfaces-source-badge` / the tabs change).
- [x] 3.3 Confirm changelog interface events pick up the new rows. → `readSchemaChangelog` applies NO entity-type filter, so the new `entity_type='interface'` name/config rows flow into the feed today (typed loosely — the `ChangelogEntityType` union widening is `server-schema-changelog` 4.3). Interface added/removed feed entries still need that change's §4; dependency + the timestamps-not-runs lifecycle caveat noted in its tasks.md (2026-07-14 update block).

## 4. Verification

- [x] 4.1 Integration test: full cycle fixture → mutated fixture → absent field → identical capture. → Built as the pure full-cycle test (capture → rename+add → remove → absent → identical short-circuit) in `interfaces-sync.test.ts`. **The repo has no live-PG test harness** (vitest-pool-workers with placeholder `DATABASE_URL`; the real-Postgres swap is a known pending item) — a Docker-PG test would fail for every developer, so the SQL layer is exercised by 4.2 instead, matching how every other per-Space IO module is verified.
- [x] 4.2 Staging/dev: hand-POST the fixture to schema-sync for a test Space; inspect per-Space DB rows + changelog output — including the manual-row byte-identical assertion from 2.4. → Automated as [smoke.mjs](smoke.mjs) (`node openspec/changes/server-mcp-interface-pages/smoke.mjs`) — 14 checks against the deployed dev engine + real per-Space DB, self-cleaning. **PASS 2026-07-14** (first capture → mutate → absent → identical → removal → manual-row isolation).
- [x] 4.3 typecheck + build + test suites green; land BEFORE `workflows-mcp-interface-pages`. → `tsc --noEmit` clean, `npm run build` clean, 177 tests green across the targeted suites (per-space + runs-start + interface-backup; full-suite run avoided per the known DO-teardown hang).
