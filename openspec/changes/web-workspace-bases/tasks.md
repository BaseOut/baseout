# Tasks

## 0. Gate (added 2026-07-27)

- [ ] 0.1 **Scope decision (Dan):** the 2026-07-27 spike (`server-mcp-workspaces/README.md`) found MCP `list_workspaces` 403s on the standard grant — workspace identity needs `workspacesAndBases:read` added to the Connect OAuth app (re-consent for existing Connections; Features §17 Q20). Do not start below until decided; if added, the paired spike re-runs on a reconsented Connection to settle the envelope (design open Q1). → per founder direction 2026-07-27 the web half was BUILT ANYWAY with graceful degradation: every path treats engine failure/404/`degraded:true` as "no workspace data" (flat picker, plain rescan), so nothing user-visible depends on the OAuth-scope outcome. **RESOLVED 2026-07-28: scope added to the code grant** (`apps/web/src/lib/airtable/config.ts` + pinned `config.test.ts`). ⚠ Remaining rollout: check `workspacesAndBases:read` on the integration at airtable.com/create/oauth BEFORE the next web deploy (oauth-setup.md §3.1/§4.2), then reconnect one Connection and re-run the paired spike for the envelope (design open Q1).

## 1. Schema

- [x] 1.1 Migration: `at_bases` + `workspace_id`/`workspace_name` (nullable text); new `space_workspaces` per the proposal shape (incl. `enrolled_via`); `backup_configurations.auto_enroll_new_workspaces` boolean default false; drizzle schema in `apps/web/src/db/schema/core.ts`. → `apps/web/drizzle/0033_workspace_bases.sql` (unique(space_id,workspace_id), enrolled_via CHECK manual|auto, last_checked_at, created/modified stamps). GENERATED, not applied (human applies at smoke time).
- [x] 1.2 `db:check` clean; header-comment note that the engine reads both tables (mirror rule per CLAUDE.md §2). → mirror header comments on `atBases` (engine reads workspace columns) and `spaceWorkspaces` (engine reads + inserts 'auto' rows), both naming the canonical 0033 migration. `db:check` reports 0031–0033 as PENDING (expected — apply-at-smoke).

## 2. Persistence (TDD)

- [x] 2.1 `persist.ts`: stamp workspace fields when provided; null-tolerant. → `AirtableBaseSummary` gains optional `workspaceId/workspaceName`; upsert stamps them (COALESCE in the onConflict set-list so a workspace-less pass never clobbers stamped values); mapping pinned by `persist-workspace.test.ts`.
- [x] 2.2 Rescan route: fetch workspace listing via `BACKUP_ENGINE` binding (engine internal route from `server-mcp-workspaces`); failure → proceed without workspace data. → best-effort post-rescan refresh in `rescan-bases.ts`: on listing success the response gains `workspaces` and enrolled rows get `last_checked_at` stamped; degraded/404/thrown listing leaves the rescan response byte-identical (3 new tests).

## 3. APIs (TDD)

- [x] 3.1 `GET /api/spaces/[spaceId]/workspaces` — proxy + auth via middleware; degraded (ungrouped) response on engine failure. → `src/pages/api/spaces/[spaceId]/workspaces.ts`: engine proxy via new `BackupEngineClient.listConnectionWorkspaces` (contract `{ok:true,workspaces:[{id,name,permissionLevel?}],capturedAt}` | `{ok:false,degraded:true,reason}` — pinned by `backup-engine-workspaces.test.ts`), merged with enrollment rows + `policySource`; ANY failure → HTTP 200 `{ ok:false, degraded:true, workspaces:[] }` exactly.
- [x] 3.2 `PUT /api/spaces/[spaceId]/workspaces` — upsert/remove enrollment rows; server-side validation; legacy-flag precedence untouched by reads (Decision 3). → declarative upsert + explicit `remove` list + optional `autoEnrollNewWorkspaces` flag write; `parseEnrollmentBody` validation (caps, types, upsert∩remove conflict); enrolledVia preserved on update ('auto' provenance survives edits); legacy `autoAddFutureBases` never read or written here.
- [x] 3.3 Picker base-listing payload gains workspace fields. → `BaseSummary` (stores/connections.ts) + `getIntegrationsState` select/mapping carry `workspaceId/workspaceName` (null-tolerant).

## 4. Verification

- [x] 4.1 Vitest on persist + precedence logic; integration on both routes; `typecheck` + `build` green. → 31 tests green (`workspace-precedence.test.ts`, `persist-workspace.test.ts`, `backup-engine-workspaces.test.ts`, `workspaces.test.ts`, rescan additions); route handlers tested via injected deps (rescan-bases pattern). `astro check`: no NEW errors (6 pre-existing).
- [x] 4.2 Cross-check contract names with `server-mcp-workspaces` + ui-only `base-picker-workspace-grouping`/`workspace-auto-enroll`; this change lands FIRST. → cross-repo contract pinned web-side: `space_workspaces` shape + mirror headers in core.ts, precedence rule in `workspace-precedence.ts` (the module server-mcp-workspaces mirrors), engine route envelope in `backup-engine.ts` docs + tests. ui-only picker fields (`workspaceId`/`workspaceName`) match the grouping spec; this change lands first as required.

## Promotion addendum (2026-07-29)

- [x] P1 Workspace-grouped picker PROMOTED: ui-only@9a8b448 BaseSelectionTable/BasePickerRow/basePickerSearch landed at `components/integrations/`, EntitySearch/typeaheadItems/airtableGlyph at `components/schema/`; old `patterns/BaseSelectionTable` → `.legacy.astro` (rollback). Real data: `getIntegrationsState` now emits `enrolledWorkspaces` (space_workspaces via `deriveWorkspaceEnrollments`, 3 unit tests), `autoEnrollNewWorkspaces` (config flag), `wsResolve:'off'` (server-persisted stamping — nothing to progressively resolve), `groupByWorkspace:true`. Placeholder-rename persists via new `POST /api/workspaces/:wsId/alias` (5 tests) → `space_workspaces.workspace_name` (placeholder-fill semantics: engine's real name overwrites). Styles → global.css per governance; stories + classification green.
- [ ] P2 Follow-up: per-workspace auto-add toggle persistence from the wizard/manage SAVE path (toggles render + drive the review line; writes ride `POST /api/spaces/:spaceId/workspaces` — not yet wired on save).
- [ ] P3 Follow-up: alias provenance ('custom' / keep-mine promotion) needs an alias column distinct from workspace_name; today rename is always placeholder-fill.
