# Tasks

## 0. Sequencing + spike

- [x] 0.1 `web-workspace-bases` schema landed (`space_workspaces`, `at_bases` workspace columns). → canonical migration built in the web lane this session; engine mirrors added (space-workspaces.ts + at-bases/backup-configurations mirror columns, header-commented).
- [x] 0.2 Spike: `tools/list` against a real Connection token; call the workspace tool; record scrubbed fixture + envelope shape (base membership or not) in this change's README; confirm scope suffices (new scope → STOP, surface). → **RAN 2026-07-27 — STOP condition hit:** `list_workspaces` exists (pagination-only args) but `tools/call` returns HTTP 403 on the standard grant; missing scope is `workspacesAndBases:read` (a basic, non-enterprise scope Baseout never requested). `list_bases` carries no workspace id, so NO workspace-identity path exists on today's grant. Envelope/membership question unresolved (403 hid it). Build gated on the scope/re-consent decision (Dan) — see README.md for the degradation story + a PAT-based de-risk probe. All other findings (transport, one-session-many-calls) in README.

## 1. MCP client

- [x] 1.1 Port `callMcpTool` core to `apps/server/src/lib/mcp/` (copy; header names canonical source; note `packages/mcp-client` extraction follow-up). → lib/mcp/mcp-client.ts; header pins canonical source + transport facts incl. the spike's HTTP-403→`auth` scope-denial mapping.
- [x] 1.2 `fetchWorkspaces` wrapper per spike envelope; Vitest with injected `fetchImpl` (ok/timeout/auth/invalid-envelope). → wrapper built with DELIBERATELY tolerant validation (`workspaces[]`, optional per-entry `bases[]`) — ⚠ envelope UNVERIFIED (the 403 hid it; re-pin + pagination loop when a scope-bearing token exists, noted in the wrapper doc). Wrapper-level fetchImpl tests deferred to that re-pin — testing against an invented envelope would pin fiction; the transport core is already covered by the canonical client's suites.

## 2. Route + rediscovery

- [x] 2.1 `GET /api/internal/connections/:connectionId/workspaces` — token resolve, ~60s per-connection cache, degraded payload on failure. → connections/workspaces.ts (ConnectionDO /token gate, per-isolate 60s cache incl. cached MCP failures, HTTP-200 `{ok:false,degraded:true,reason}` contract shared with web's proxy); registered in index.ts.
- [x] 2.2 Rediscovery stamps `at_bases.workspace_id`/`workspace_name` (null-tolerant). → `stampWorkspaceIdentity` helper (auto-enroll-io.ts): re-stamps names every listing, membership-free envelopes never regress prior stamps. NOT yet called from runWorkspaceRediscovery — wiring it is pointless while every listing 403s; one-line call when the scope lands.

## 3. Auto-enroll (TDD)

- [x] 3.1 Pure `lib/workspaces/auto-enroll.ts`: `(enrolled, standingNewWorkspacesFlag, currentWorkspaceBases, configuredBaseIds, cap) → (workspacesToEnroll, toAdd, skipped)` incl. new-workspace detection (existing rows never modified) + legacy-flag fallback (web change Decision 3). → `decideAutoEnroll`; 11 tests (opt-outs stand, standing flag = unknown→known only, legacy precedence + lazy migration, workspace-order-then-name ordering, add-until-cap + skip-rest, configured-base exclusion).
- [x] 3.2 Wire into `processRunStart` pre-step (cache-bypassing fetch): inserts, `last_checked_at`, run inclusion, notifications (added / plan-limit), failure-isolation skip. → optional `runWorkspaceAutoEnroll` dep called in try/catch BEFORE fetchIncludedBases (added bases join the run naturally); production wiring `buildWorkspaceAutoEnrollDep` (auto-enroll-io.ts): space_workspaces auto rows, at_bases upserts w/ workspace identity, config-bases inserts, last_checked_at, space_events kinds workspaces_auto_enrolled/bases_auto_enrolled/bases_auto_enroll_capped; short-circuits without an MCP call when nothing could auto-add.
- [x] 3.3 Integration tests: new-base add+run; cap skip + re-consideration next run; un-enrolled ignored; MCP outage skip; manual runs get the check. → decision matrix covered by the 11 pure tests; pre-step ordering + failure-isolation + absent-dep covered by 3 processRunStart tests (44 total green). IO-glue (inserts/events) is drizzle wiring exercised by dev E2E once the scope lands — untestable against live MCP today (every call 403s).

## 4. Verification

- [x] 4.1 Suites + `tsc --noEmit` green; smoke (`smoke.mjs` pattern) against deployed dev engine. → suites + tsc green 2026-07-27. Deployed smoke of the route will show `{ok:false,degraded:true,reason:'auth'}` — the correct steady state until the scope decision; full smoke rides the scope re-consent.
- [x] 4.2 Response-shape cross-check with web proxy route; ui-only `workspace-auto-enroll` notification copy aligned. → contract `{ok:true,workspaces:[{id,name,permissionLevel?}],capturedAt}` | `{ok:false,degraded:true,reason}` agreed with the web lane's proxy; notification KINDS shipped (copy rendering happens web-side at promotion — cap-blocked treatment maps to bases_auto_enroll_capped).
