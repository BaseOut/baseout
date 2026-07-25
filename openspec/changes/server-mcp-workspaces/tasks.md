# Tasks

## 0. Sequencing + spike

- [ ] 0.1 `web-workspace-bases` schema landed (`space_workspaces`, `at_bases` workspace columns).
- [ ] 0.2 Spike: `tools/list` against a real Connection token; call the workspace tool; record scrubbed fixture + envelope shape (base membership or not) in this change's README; confirm scope suffices (new scope → STOP, surface).

## 1. MCP client

- [ ] 1.1 Port `callMcpTool` core to `apps/server/src/lib/mcp/` (copy; header names canonical source; note `packages/mcp-client` extraction follow-up).
- [ ] 1.2 `fetchWorkspaces` wrapper per spike envelope; Vitest with injected `fetchImpl` (ok/timeout/auth/invalid-envelope).

## 2. Route + rediscovery

- [ ] 2.1 `GET /api/internal/connections/:connectionId/workspaces` — token resolve, ~60s per-connection cache, degraded payload on failure.
- [ ] 2.2 Rediscovery stamps `at_bases.workspace_id`/`workspace_name` (null-tolerant).

## 3. Auto-enroll (TDD)

- [ ] 3.1 Pure `lib/workspaces/auto-enroll.ts`: `(enrolled, standingNewWorkspacesFlag, currentWorkspaceBases, configuredBaseIds, cap) → (workspacesToEnroll, toAdd, skipped)` incl. new-workspace detection (existing rows never modified) + legacy-flag fallback (web change Decision 3).
- [ ] 3.2 Wire into `processRunStart` pre-step (cache-bypassing fetch): inserts, `last_checked_at`, run inclusion, notifications (added / plan-limit), failure-isolation skip.
- [ ] 3.3 Integration tests: new-base add+run; cap skip + re-consideration next run; un-enrolled ignored; MCP outage skip; manual runs get the check.

## 4. Verification

- [ ] 4.1 Suites + `tsc --noEmit` green; smoke (`smoke.mjs` pattern) against deployed dev engine.
- [ ] 4.2 Response-shape cross-check with web proxy route; ui-only `workspace-auto-enroll` notification copy aligned.
