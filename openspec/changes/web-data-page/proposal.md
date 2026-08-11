## Why

The engine is gaining a full read layer over backed-up record data ([`server-data-browse`](../server-data-browse/): keyset-paginated reads, per-record history, provenance/link expansion, changelog, search, exports, static-snapshot ingest) — but nothing in the product surfaces it. The ui-only [`data-page`](../../../../ui-only/openspec/changes/data-page/) change defines the **Data** page (Browse · Changelog · Docs · Chat, record detail sidebar, cross-Space search, exports). This change is the web half: proxy routes, capability gating, the nav item, and the port of the ui-only views — the same pairing as `server-schema-chat` ↔ `web-chat-tab`.

## What Changes

- **New "Data" nav item** in the Space group, after Schema (Home · Backups · Schema · **Data** · Reports · Restore), route `/data`.
- **Proxy routes** under `/api/spaces/:spaceId/data/*` forwarding to the engine's `INTERNAL_TOKEN`-gated `/api/internal/spaces/:spaceId/data/*` surface via the `BACKUP_ENGINE` service binding: records page, record detail, history, links/provenance expansion, changelog, search, export (sync stream passthrough + async job polling), and static-review ingest/status/purge.
- **Web client methods** on `backup-engine.ts` + view types for every route above (mirroring the chat/schema client-method pattern).
- **Capability gating** resolved from Stripe metadata tier via `tier-capabilities.ts` — reconcile the exact tier mapping with Features §5.5/§7 during implementation (don't invent a matrix entry): the Data page itself, exports, and data Chat (`manual_ai`, Pro+ — same level as schema chat) gate separately. Below-tier renders the standard upgrade affordance.
- **Static vs dynamic awareness**: the page detects the Space's backup mode. Dynamic → full experience. Static-only → consent dialog (names the snapshot, scope/size, temporariness) before `POST /data/static-review` ingest; History/Changelog/Chat render locked "Available with dynamic backups" upsell states.
- **Port of the ui-only `DataView`** through the ui-sync promotion workflow (`shared/internal/ui-sync.md` + `/ui-sync` skill): Browse grid (cursor "Load more", per-field filters, sort, column show/hide), record detail sidebar (Fields + History + formula/linked/lookup cell provenance), Changelog tab, Docs tab (existing Docs surface scoped to data), Chat tab (thread/composer reuse from `web-chat-tab`), CSV/JSON export with async-job notification.

## Capabilities

### New Capabilities
- `data-page`: the Data page — paginated record browsing with per-field filtering, cross-base/table search, record detail sidebar with backup history and cell provenance, Space-wide data changelog, data-scoped Docs and Chat tabs, CSV/JSON export, and consent-gated static-snapshot review.

### Modified Capabilities
- `navigation`: Space group gains **Data** after Schema.

## Impact

- `apps/web/src/lib/backup-engine.ts` — data client methods + view types.
- Proxy routes: `pages/api/spaces/[spaceId]/data/*` (records, record detail/history/links/provenance, changelog, search, export, static-review) — all middleware-guarded + capability-gated; server-side validation on every param (route tests first, per §3.4).
- `DataView.astro` + nav entry — ported per strict two-tier component governance (Storybook `ui/*` + `patterns/*` only; promotion, not recreation — intake order per ui-sync §4.2).
- **Blocked on**: `server-data-browse` §3 routes. Data **Chat** additionally blocked on [`shared-ai-controls`](../shared-ai-controls/) enforcement (+ `workflows-data-chat` for the model call) — ships as a locked tab until then. Static-review consent UI rides server task 3.5b.
- **Pairs with**: ui-only [`data-page`](../../../../ui-only/openspec/changes/data-page/), [`server-data-browse`](../server-data-browse/) (filed per its task 4.2).
- No engine/DB detail here — proxy + gating + UI only. No new migrations.
