# web-saved-views

> Phase 3 pairing of `plans/2026-08-27-mcp-app-parity.md` (with `server-saved-views` +
> `api-views-tools`), per §3.6 single-app naming.

## Why

The Data Browse preset model (Save/Discard/Draft/lock — Dan's 2026-07-23 rules) persists
entirely in a localStorage "PERSISTENCE BLOCK" inside `DataBrowse.astro` whose own comment says
the monorepo engineer swaps it for real API calls. With `server-saved-views` the backend now
exists; without this change, presets saved in the UI are invisible to MCP (and vice versa) and
die with the browser profile.

## What Changes

- **Serializer extraction**: the Serialized* types + serialize/deserialize/config-equality
  functions move from the DataBrowse inline script to `src/lib/data-browse/preset-serialize.ts`
  (pure, vitest'd) — the shared wire format `server-saved-views` stores opaquely.
- **Engine client + proxy routes**: `listSavedViews/createSavedView/updateSavedView/
  deleteSavedView` in `lib/backup-engine`; `/api/spaces/:spaceId/views[/:viewId]` proxies
  cloned from the documents proxy shape (same `guardSchemaDocsRequest` gate the Data proxies
  use).
- **Persistence swap**: the page SSR-loads saved presets from the engine and passes them into
  DataBrowse; the PERSISTENCE BLOCK merges them as the saved layer. localStorage KEEPS the
  draft layer (drafts, unsaved edits, open tabs, active id). Save/rename/pin/delete of a saved
  preset call the proxy.

## Impact

apps/web only. Depends on server-saved-views. Design + tasks in this directory.
