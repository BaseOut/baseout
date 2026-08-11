## Status

Not started. Web half of the Data page over [`server-data-browse`](../server-data-browse/).
Blocked on server-data-browse §3 routes; the Chat tab additionally on
[`shared-ai-controls`](../shared-ai-controls/) + `workflows-data-chat`.

---

## 1. Web client + proxy routes (tests first)

- [ ] 1.1 `backup-engine.ts` — data client methods + view types: `listTableRecords` (cursor/filters/sort/projection), `getRecord`, `getRecordHistory`, `expandRecordLinks`, `getRecordProvenance`, `getDataChangelog`, `searchData`, `startDataExport` / `getDataExport`, `startStaticReview` / `getStaticReview` / `purgeStaticReview`.
- [ ] 1.2 Proxy routes under `pages/api/spaces/[spaceId]/data/` — all middleware-guarded + capability-gated, params validated server-side, filters passed through opaque (the engine owns filter semantics): `tables/[tableId]/records.ts` (GET), `records/[recordId].ts` (GET), `records/[recordId]/history.ts` (GET), `records/[recordId]/links/[fieldId].ts` (GET), `records/[recordId]/provenance/[fieldId].ts` (GET), `changelog.ts` (GET), `search.ts` (GET), `export.ts` (POST) + `export/[jobId].ts` (GET), `static-review.ts` (POST/GET/DELETE). Sync export streams the engine response body through without buffering. Route tests per file (gate 403 below tier, param validation 400, engine passthrough shape).
- [ ] 1.3 Tier mapping reconciled with Features §5.5/§7 in `tier-capabilities.ts` (+ test) — Data page level, export level, data-chat rides the existing `manual_ai` level. Flag a spec conflict rather than inventing if the matrix has no entry.

## 2. Data page UI (port via /ui-sync)

- [ ] 2.1 Nav: "Data" in the Space group after Schema (`app-config` + route `/data`); below-tier renders the standard upgrade affordance page.
- [ ] 2.2 Port `DataView.astro` per ui-sync §4.2 intake order (Storybook `ui/*`/`patterns/*` reuse; no ungoverned components): Browse tab — base/table pickers (standard filter menus), paginated grid (cursor "Load more" + virtualized rows), per-field filters by field type, sort, column show/hide, approximate-total display ("~").
- [ ] 2.3 Record detail sidebar (shared detail-sidebar pattern): Fields section (decoded values, attachment thumbnails, linked-record chips) + History section (created/updated/deleted timeline, per-field before → after) + cell provenance (formula inputs, searchable paginated linked-set expansion, lookup sources) — one expansion level per interaction (matches the engine's no-recursion contract).
- [ ] 2.4 Changelog tab — per-run rollups + row lists, base/table/field/change-type/run-range filters, entries open the record sidebar. Cross-Space search mode — grouped base → table results, `partial: true` renders "showing first matches".
- [ ] 2.5 Docs tab — existing Docs surface scoped to data (reuse, no fork). Chat tab — locked/upsell state until `shared-ai-controls` + `workflows-data-chat` land; then thread/composer reuse from `web-chat-tab` with Browse-filter-scoped context.
- [ ] 2.6 Export affordances on Browse + Changelog: CSV/JSON, `setButtonLoading` on submit, sync download vs async job with notification on completion (inbox feed).
- [ ] 2.7 Static-only Spaces: mode detection, consent dialog (snapshot name, scope/size, temporary-copy statement) → ingest progress (pollable) → per-snapshot browsing; locked upsell states on History/Changelog/Chat; purge control. Update `shared/internal/ui-sync.md` ledger in the same change as the promotion.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/web typecheck` + `build` green; new route tests green; `audit:components` clean; no stray `console.*`; mobile pass at <375/<768/<1024.
- [ ] 3.2 Human smoke: dynamic Space → `/data` → browse a table (filters + Load more) → open a record → history + a formula/link provenance expansion → changelog entry → cross-Space search → CSV export downloads. Static-only Space → consent dialog → ingest → browse → purge. Below-tier account sees the upgrade affordance.
