# Tasks

## 1. Schema

- [ ] 1.1 Migration: `at_bases` + `workspace_id`/`workspace_name` (nullable text); new `space_workspaces` per the proposal shape (incl. `enrolled_via`); `backup_configurations.auto_enroll_new_workspaces` boolean default false; drizzle schema in `apps/web/src/db/schema/core.ts`.
- [ ] 1.2 `db:check` clean; header-comment note that the engine reads both tables (mirror rule per CLAUDE.md §2).

## 2. Persistence (TDD)

- [ ] 2.1 `persist.ts`: stamp workspace fields when provided; null-tolerant.
- [ ] 2.2 Rescan route: fetch workspace listing via `BACKUP_ENGINE` binding (engine internal route from `server-mcp-workspaces`); failure → proceed without workspace data.

## 3. APIs (TDD)

- [ ] 3.1 `GET /api/spaces/[spaceId]/workspaces` — proxy + auth via middleware; degraded (ungrouped) response on engine failure.
- [ ] 3.2 `PUT /api/spaces/[spaceId]/workspaces` — upsert/remove enrollment rows; server-side validation; legacy-flag precedence untouched by reads (Decision 3).
- [ ] 3.3 Picker base-listing payload gains workspace fields.

## 4. Verification

- [ ] 4.1 Vitest on persist + precedence logic; integration on both routes; `typecheck` + `build` green.
- [ ] 4.2 Cross-check contract names with `server-mcp-workspaces` + ui-only `base-picker-workspace-grouping`/`workspace-auto-enroll`; this change lands FIRST.
