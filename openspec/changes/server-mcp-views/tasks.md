# Tasks

## 0. Sequencing

- [ ] 0.1 Workflows spike fixture (envelope depth) — determines the Decision 4 branch + whether task 1.2 runs.

## 1. Contract + (conditional) schema

- [ ] 1.1 Define the `views` schema-sync field + `viewCaptureMode` payload flag in `per-space/views-sync.ts` — single source for both repos.
- [ ] 1.2 CONDITIONAL (definition-grade envelope only): per-Space migration adding `bo_at_views.definition` jsonb — version bump behind `system-per-space-db`.

## 2. Mode + pure module (TDD)

- [ ] 2.1 `view-capture.ts`: `resolveViewCaptureForRun` → `'rest'|'mcp'|'off'` (override honored); existing REST tests pass unmodified.
- [ ] 2.2 `views-sync.ts`: extraction, lifecycle diff, rename detection, config delta (conditional), identical-capture short-circuit.
- [ ] 2.3 Sweep rule: `shouldSweepUnknownViews(mode, mcpCaptureOk)` per design Decision 3.

## 3. IO + route

- [ ] 3.1 `space-db-pg.ts`: `readViewWorkingSet` / `applyViewDiff`.
- [ ] 3.2 schema-sync route wiring in the same `withSpaceSchema` transaction.
- [ ] 3.3 Integration tests: first fill; removal; rename; absent-field no-op; sweep-prevented; both-sources-absent sweep; enterprise REST path byte-identical.

## 4. Verification

- [ ] 4.1 Suites + `tsc --noEmit` green; contract cross-check with `workflows-mcp-views` (land THIS first).
- [ ] 4.2 Dev E2E: non-enterprise connection gains view rows + changelog events; ui-only `view-schema-details` fixture names aligned with the envelope.
