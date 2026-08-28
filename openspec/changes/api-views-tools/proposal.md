# api-views-tools

> Phase 3 pairing of `plans/2026-08-27-mcp-app-parity.md` (with `server-saved-views` +
> `web-saved-views`), per §3.6 single-app naming.

## Why

Dan (2026-08-27): "create/update/ask of the views within schema/data" from MCP. Data presets
are THE view object (Schema's equivalents — diagrams — already persist under Documents and are
reachable via `api-documents-tools`). `server-saved-views` builds the backend; this change is
the public API/MCP layer over it.

## What Changes

- `apps/api/src/operations/views.ts` + 5 MCP tools: `list_views`, `get_view`, `create_view`,
  `update_view`, `delete_view` under `/v1/orgs/{orgId}/spaces/{spaceId}/views[/{viewId}]`.
- Scopes: `views:read` / `views:write` (already in the Phase 0 vocabulary — no scope change).
- `config` is a loosely-validated object (the web-owned SerializedConfig shape, opaque to the
  API just as it is to the engine); `tableId` is create-only — PATCH carries no tableId, and the
  broker enforces `table_locked` (server-saved-views D3).
- Attribution per plan D3: token's issuing user → `created_by_user_id`.

## Impact

apps/api only. Depends on `api-write-foundation` (write plumbing) + `server-saved-views`
(broker). Blocked-by nothing else; blocks nothing.
