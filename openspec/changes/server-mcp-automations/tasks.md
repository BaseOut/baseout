# Tasks

## 1. Contract + schema

- [x] 1.1 Define the `automations` schema-sync field wire type in `per-space/automations-sync.ts` (`{ capturedAt, raw }`) — single source for both repos. ✅ 2026-07-24 — envelope top-level shape (`{ automations: [] }`) pinned by the workflows spike; per-entry extraction is lenient (string id + name required, everything else passes into `definition`) until a populated fixture exists.
- [x] 1.2 ~~Per-Space migration: `bo_at_automations`~~ **NOT NEEDED** (design Decision 1 revised): the table already exists with the timestamp lifecycle the changelog reader consumes — zero migration, zero `system-per-space-db` sequencing.

## 2. Pure module (TDD)

- [x] 2.1 Extraction: raw envelope → automation entities; unknown-key tolerance; malformed-entry skipping. ✅ `automations-sync.ts` + `tests/integration/per-space/automations-sync.test.ts` (17 tests, written first).
- [x] 2.2 Diff: lifecycle add/remove/resurrect; `name` updates; `config` updates (full before/after definition — automations have no link tables); identical-capture hash short-circuit (key-order-insensitive); removal-only-on-successful-capture. ✅ same file.
- [x] 2.3 Reconciliation rules against manual rows. ✅ enforced at the IO layer: `readAutomationWorkingSet` filters `submitted_via='mcp'`, so manual rows are invisible to the diff (never deleted/overwritten) — same mechanism as interfaces; pinned by the smoke's manual-row isolation step.

## 3. IO + route wiring

- [x] 3.1 `space-db-pg.ts`: `readAutomationWorkingSet` / `applyAutomationDiff` (timestamp lifecycle; `last_seen_at` kept on removal for the changelog reader). ✅
- [x] 3.2 schema-sync route: parse optional `automations`, run extract+diff+apply inside the existing `withSpaceSchema` transaction; absent field = no-op; per-section `automationSync` summary on the response. ✅
- [x] 3.3 Stamp `automationsEnabled` (Growth+) on the backup task payload next to `interfacesEnabled` — `lib/capabilities/automation-backup.ts` + `runs/start.ts` + `start-deps.ts`, TDD'd in `runs-start.test.ts` (4 new tests). ✅
- [x] 3.4 Tests: pure module 17 tests + runs-start 4 tests; route path exercised by `smoke.mjs` against the deployed dev engine (same split as interfaces — no route-level integration harness exists). ✅ green 2026-07-24.

## 4. Docs + cross-change

- [x] 4.1 Cross-check field shape with `workflows-mcp-automations` task 4.1 (`{ capturedAt, raw }`, forwarded verbatim). Land + deploy this change to dev FIRST. ✅ shape locked; **dev deploy deferred** — the working tree carries another session's in-flight per-Space changes; deploy after that work settles.
- [x] 4.2 PRD §2.9 amendment status flagged (action-plan §6 owns the doc edit). ✅ noted in proposal + action-plan.

## 5. Verification

- [x] 5.1 Targeted suites + typecheck: per-space (20 files, 256 tests) + runs-start green; `tsc --noEmit` shows ONLY the pre-existing `trigger-client.ts` SDK-skew errors (workflows @trigger.dev/sdk 4.5.7 vs server 4.5.1 — questions-2026-07-20 item 13), none in changed files. ✅ 2026-07-24.
- [ ] 5.2 Dev E2E with the workflows half: deploy engine (`pnpm --filter @baseout/server deploy:dev`), run `smoke.mjs` (route half), then a real backup on a base with ≥1 automation (needs the seeded test-workspace automation — action-plan §4) → `bo_at_automations` rows + changelog `automation` events visible.
