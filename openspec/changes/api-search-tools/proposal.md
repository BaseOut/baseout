# api-search-tools

> **Filed for sequencing** (Phase 4 of `plans/2026-08-27-mcp-app-parity.md`). Paired follow-up to
> file when it starts: `web-entity-deeplinks` (the `?entity=`/`?record=` URL-addressability that
> makes tool results clickable). Design + tasks authored then.

## Why

Dan (2026-08-27): "search and open sidebars based on querying for records/fields/attachments/
tables/bases/etc". Schema search is already an MCP tool. Record search is BUILT server-side and
ORPHANED — `data-search.ts` + `record-search-io.ts` (ILIKE over record values + field names,
grouped base→table, scan-budgeted) have zero consumers; not even the app calls them. Nothing
searches documents, reports, or attachments. And "open sidebars" needs URL-addressable panels:
today `?tab=`/`?comment=`/`?asset=` work but schema panels are event-only (`schema:openEntity`)
with no `?entity=` param.

## What Changes

- Wire the orphan: engine-client + web proxy for record search (the Data page gains real record
  search as a side effect) + apps/api operation/tool `search_records` (scope `data:read`).
- New search coverage: `search_documents` (title/excerpt), `search_reports` (definitions),
  `search_attachments` (existing media endpoint's filters exposed).
- `web-entity-deeplinks`: `?entity=` on /schema and `?record=` on /data, using the proven
  `?comment=` deferred-dispatch pattern from DataComments.
- Every search/get tool's results gain an `appUrl` deep link (plan D4) — including a retrofit
  across the existing 18 read tools.

## Impact

apps/api + apps/server (small search brokers for docs/reports) + apps/web (deep links + the
record-search proxy). Depends on api-write-foundation (dispatch hardening) only.
