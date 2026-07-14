# Tasks

## 1. Contract + extraction

- [ ] 1.1 Define the `interfacePages` schema-sync payload type (`{ capturedAt, raw: { interfaces[], standaloneForms[] } }`) in the engine's schema-sync types — this file is the contract source for `workflows-mcp-interface-pages` task 4.1.
- [ ] 1.2 `src/lib/per-space/interfaces-sync.ts` (pure): `extractInterfaceEntities(raw)` → app/page/form entities (id, name, type, definition) + envelope-tolerant validation (unknown keys pass through; entities without id+name dropped with a count).
- [ ] 1.3 Tests (TDD, owner's fixture): extraction shape, standalone-form handling, malformed-entity tolerance.

## 2. Diff + persistence

- [ ] 2.1 `diffInterfaces(prev, next)` (pure): added/removed sets, name deltas, composition deltas (`pageType`, `sourceTableId`, field-id usage incl. `isEditable` flips — ids only, never names/options), capture-hash short-circuit.
- [ ] 2.2 Tests: page add/remove/rename, field-usage delta, rename-echo suppression (schema field rename → zero interface rows), unchanged-hash short-circuit, removal-only-on-successful-capture.
- [ ] 2.3 Wire into schema-sync inside `withSpaceSchema`: upserts (`submitted_via='mcp'`), lifecycle stamps, `bo_at_schema_updates` writes with the run association; per-section error isolation (interface parse failure reports on run progress, never fails schema sync).
- [ ] 2.4 Verify manual-submission rows are untouched by MCP processing (test: manual row byte-identical after an MCP capture of the same entity id).

## 3. Tier flag + reads

- [ ] 3.1 Add `interfaces_enabled` (Growth+ capability resolution) to the run-assembly payload beside `records_enabled`; test both tiers.
- [ ] 3.2 Check the existing web Interfaces read path: if it doesn't dedupe by `airtable_entity_id`, gate `submitted_via='mcp'` rows out of that read and flag the web follow-up (`web-interfaces-source-badge`) — do NOT bundle web changes here.
- [ ] 3.3 Confirm changelog interface events (`server-schema-changelog` §3–§5 scope) pick up the new rows; if that scope hasn't landed, note the dependency in its tasks rather than duplicating aggregator work here.

## 4. Verification

- [ ] 4.1 Integration test (real local PG per §3.4): full schema-sync POST with fixture → rows, lifecycle, update rows; second POST with a mutated fixture → expected events; third POST without the field → nothing changes.
- [ ] 4.2 Staging: hand-POST the fixture to schema-sync for a test Space; inspect per-Space DB rows + changelog output.
- [ ] 4.3 typecheck + build + test suites green; land BEFORE `workflows-mcp-interface-pages`.
