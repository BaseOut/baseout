# web-workspace-bases — Proposal

## Why

Airtable's MCP server now exposes **workspace listing to all connections** — previously Enterprise-only via the REST API (founder direction, 2026-07-25). Bases in Baseout carry no workspace identity today (`at_bases` has none; only `connections.platformConfig.airtable.at_workspace_id` hints at one workspace), so the picker can't group by workspace and a Space can't be tied to workspaces. This change owns the master-DB schema and web APIs: workspace identity on bases, per-Space workspace enrollment (multiple workspaces per Space, each with an auto-add-future-bases flag), and the picker/settings data paths. The engine-side MCP listing and per-run auto-enroll check are the paired [`server-mcp-workspaces`](../server-mcp-workspaces/proposal.md).

## What Changes

- **Master-DB migration (web owns migrations):**
  - `at_bases` gains nullable `workspace_id` + `workspace_name` (text) — stamped by rescan/callback persistence and by the engine's rediscovery reconcile.
  - New `space_workspaces` table: `id` pk · `space_id` fk → `spaces` · `workspace_id` · `workspace_name` · `auto_enroll_future_bases` boolean default false · `enrolled_via` (`'manual' | 'auto'`) · `last_checked_at` · created/updated stamps · unique `(space_id, workspace_id)`. A Space may enroll **multiple** workspaces.
  - `backup_configurations` gains **`auto_enroll_new_workspaces`** boolean default false — the standing toggle (founder direction, 2026-07-25): companies add workspaces routinely, so "all workspaces" must cover workspaces that don't exist yet. When true, a workspace newly appearing on the connection is auto-enrolled (an `enrolled_via='auto'` row with `auto_enroll_future_bases=true` is created by the engine at run start) and its bases auto-added. Per-workspace rows remain the unit of truth for the known set; this flag governs only *not-yet-known* workspaces.
- **Persist path:** `apps/web/src/lib/airtable/persist.ts` + rescan route stamp workspace fields when workspace data is available (fetched from the engine's internal workspaces route via the `BACKUP_ENGINE` service binding); absence of workspace data never blocks base persistence.
- **Picker API:** the base-listing response for the picker surfaces gains `workspaceId`/`workspaceName` per base; a new `GET /api/spaces/[spaceId]/workspaces` returns the connection's workspace list (proxied from the engine, short-TTL) for grouping headers.
- **Enrollment API:** `PUT /api/spaces/[spaceId]/workspaces` upserts `space_workspaces` rows (enroll/un-enroll + flag). Server-side validation; middleware-gated like the other space routes.
- **Legacy-flag precedence:** `backup_configurations.autoAddFutureBases` (existing, connection-wide) is kept for backward compatibility: when a Space has NO `space_workspaces` rows, the legacy flag means "all workspaces including future ones" (equivalent to all rows on + `auto_enroll_new_workspaces` on); once any row exists, rows + the new-workspaces flag are authoritative and the legacy flag is ignored. The first save from the new UI materializes both (rows per current workspace + the standing flag per the user's toggle).

## Capabilities

### New Capabilities

- `workspace-bases`: workspace identity on bases, per-Space multi-workspace enrollment with auto-add flags, and the picker/enrollment APIs.

### Modified Capabilities

None — base selection persistence (`backup_configuration_bases.isIncluded`) is untouched.

## Impact

- **App:** `apps/web` only — migration + `persist.ts` + rescan route + two API routes. UI lives in the ui-only fork (`base-picker-workspace-grouping`, `workspace-auto-enroll`) and promotes via the ui-sync flow.
- **Cross-repo contract:** `space_workspaces` shape + legacy-flag precedence rule — owned by THIS change; `server-mcp-workspaces` reads them. Land this change first.
- **No new secrets. No per-Space DB change. No OAuth scope change** (MCP uses the existing Connection token — verified pattern from interface-pages).
- **Spec conflict to flag** (CLAUDE.md §1): the Features spec's naming dictionary uses "Workspace" as an Airtable-side term; these columns store *Airtable* workspace identity (never Baseout structure) — naming stays `workspace_*` prefixed under `at_`/space-scoped tables to avoid dictionary collision.
