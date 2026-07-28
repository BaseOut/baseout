# Tasks

## 0. Sequencing

- [x] 0.1 Workflows spike fixture (envelope depth) — determines the Decision 4 branch + whether task 1.2 runs. → **RESOLVED 2026-07-27 (spike in `workflows-mcp-views/README.md`):** envelope is inventory-grade (`{views:[{id,name,type}]}`, per-TABLE tool `list_views_for_table`) — Decision 4 takes the **no-migration branch**; task 1.2 does NOT run. Contract note for 1.1: the `views` field aggregates per-table results (shape owned here); tool is per-table, so absent-table vs absent-field semantics must be pinned in the wire type.

## 1. Contract + (conditional) schema

- [x] 1.1 Define the `views` schema-sync field + `viewCaptureMode` payload flag in `per-space/views-sync.ts` — single source for both repos. → `ViewsCapture` (per-table aggregation of `list_views_for_table` envelopes, all-or-skip) in views-sync.ts; `ViewCaptureMode` in view-capture.ts; payload flag on `BackupBaseTaskPayload` (runs/start.ts).
- [ ] ~~1.2 CONDITIONAL (definition-grade envelope only): per-Space migration adding `bo_at_views.definition` jsonb — version bump behind `system-per-space-db`.~~ **DROPPED 2026-07-27:** spike showed inventory-grade envelope — no migration in this change.

## 2. Mode + pure module (TDD)

- [x] 2.1 `view-capture.ts`: `resolveViewCaptureForRun` → `'rest'|'mcp'|'off'` (override honored); existing REST tests pass unmodified. → `resolveViewCaptureModeForRun` + `viewCaptureModeFromConnection` + `resolveViewCaptureMode` (override "1" → 'rest'); legacy boolean helpers retained; REST-path tests (isEnterprise/strip/setting) untouched and green.
- [x] 2.2 `views-sync.ts`: extraction, lifecycle diff, rename detection, config delta (conditional), identical-capture short-circuit. → parse (absent/invalid/ok+dropped, all-or-skip strictness per table), diff mirrors schema-diff's views block (insert/seen/removed lifecycle + name/type schema-updates); config delta DROPPED (inventory-grade envelope); short-circuit blocked while `unknown` rows exist (they must resolve on a sighting). 16 tests.
- [x] 2.3 Sweep rule: `shouldSweepUnknownViews(mode, mcpCaptureOk)` per design Decision 3. → `shouldSweepUnknownViews(mode, viewsSighted)`; route computes viewsSighted = restMode || mcp capture ok || REST payload carried views (belt-and-braces).

## 3. IO + route

- [x] 3.1 `space-db-pg.ts`: `readViewWorkingSet` / `applyViewDiff`. → plus `stampViewsSeenForBase` (unchanged-capture last_seen stamp); applyViewDiff reuses the SAME lifecycle writer as the REST path (byte-identical row semantics).
- [x] 3.2 schema-sync route wiring in the same `withSpaceSchema` transaction. → guarded pure-diff pattern identical to interfaces/automations; response gains `viewCaptureMode` + optional `viewsSync` summary (old boolean `viewCapture` field replaced — no consumer existed); `views` on a 'rest' run reports `{ok:false, reason:'rest_mode'}` (REST wins).
- [x] 3.3 Integration tests: first fill; removal; rename; absent-field no-op; sweep-prevented; both-sources-absent sweep; enterprise REST path byte-identical. → covered at the pure-module + stamp level (views-sync.test.ts 16, view-capture.test.ts 12, runs-start.test.ts +3) — the same coverage tier as the automations precedent (no schema-sync route test file exists for any capture kind); REST byte-identity pinned by unmodified schema-diff.test.ts + REST-path view-capture tests. Route-level E2E rides 4.2.

## 4. Verification

- [x] 4.1 Suites + `tsc --noEmit` green; contract cross-check with `workflows-mcp-views` (land THIS first). → 71 tests across the four touched suites + tsc green (2026-07-27); this half landed first, workflows half consumes `ViewsCapture`/`viewCaptureMode` shapes.
- [ ] 4.2 Dev E2E: non-enterprise connection gains view rows + changelog events; ui-only `view-schema-details` fixture names aligned with the envelope. → **View-rows leg VERIFIED 2026-07-28** (fresh run `855a94ad…`: `bo_at_views` = 4 rows via MCP on the non-enterprise dev connection, stable across runs). Remaining legs: changelog-events assertion + ui-only fixture-name alignment.
