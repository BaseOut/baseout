# web-entity-deeplinks

> Phase 4 pairing of `plans/2026-08-27-mcp-app-parity.md` (with `api-search-tools`), per §3.6.

## Why

Dan (2026-08-27): "search and open sidebars". The MCP search tools return `appUrl` deep links
(api-search-tools D4), but schema entity panels are event-only (`schema:openEntity`) and record
panels open only from grid clicks (`data:openRecord`) — neither is URL-addressable, so a link
can land on the right page but can't open the right panel. `?tab=`/`?comment=`/`?asset=`
already work; this closes the gap for entities and records.

## What Changes

- `?entity=<id>` on /schema: dispatch `schema:openEntity` after `load`, using the proven
  deferred-dispatch pattern from DataComments' `?comment=` (module-script listener races —
  dispatching before `load` silently no-ops).
- `?record=<id>&table=<tableId>` on /data: same pattern, dispatching `data:openRecord`.
- Record-search proxy: engine client `dataSearch` + `/api/spaces/:spaceId/data/search` route
  (clone of the records proxy) so the Data page can adopt real server-side record search;
  wiring it into the Browse search box is deliberately NOT in scope (the box is client-filter
  by design today — a UI decision for the design fork, not a migrator).

## Impact

apps/web only. Depends on nothing (the api half consumes the engine broker directly).
Design decisions inline above; tasks in tasks.md.
