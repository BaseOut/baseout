# server-media-index — Proposal

## Why

The ui-only `media-library` change specs a digital-asset-management surface over captured attachments — listing/gallery, media-type filters, provenance trails, storage-aware access, totals. Nothing serves it: the pipeline captures attachments (with checksum dedup) to managed R2 or BYOS destinations and records only per-run counts/sizes. This change builds the engine side: a **per-Space asset index**, the **batched metadata-ingest route** fed by the backup task (paired [`workflows-media-metadata`](../workflows-media-metadata/proposal.md)), the **read/query API** web proxies for the library UI, and **download streaming** for Baseout-stored assets.

**Scope flag (CLAUDE.md §1):** a media-library capability appears nowhere in the v1.1 scope-locked PRD/Features matrix — same amendment blocker pattern as comments (entity row, capability name, tier). Recommendation: the library rides the **Data capability surface** (requires dynamic mode; no new gate) — Dan confirms in the Features amendment.

## What Changes

- **Per-Space schema — two tables** (migration behind `system-per-space-db`):
  - **`bo_at_assets`** — one row per unique asset per Space: content checksum (the dedup identity the writer already computes) · content type · size bytes · storage locator (`storage_kind: 'r2_managed' | 'destination'`, R2 object key or provider + path) · thumbnail fields (status + key — populated by a future change, see design) · first/last-seen stamps.
  - **`bo_at_asset_refs`** — one row per appearance: asset fk · base/table/record/field ids · Airtable attachment id · filename **as named in that record** (same bytes, different names) · lifecycle stamps. Dedup = one asset, N refs.
- **Ingest route `POST /api/internal/spaces/media-sync`** (INTERNAL_TOKEN-gated, batched like comments-sync): the backup task reports attachment metadata as it exports — upserting assets by checksum and refs by attachment id, with per-record `complete` semantics for ref-deletion safety (a ref absent from a `complete` re-capture of its record is marked removed; assets with zero live refs are removal candidates for the retention machinery, never hard-deleted here).
- **Read API for the library UI** (INTERNAL_TOKEN-gated; web proxies over the service binding): `GET /api/internal/spaces/:spaceId/media` — filterable (content-type class, base/table, size range, capture date), sorted (default newest-first), paginated, each item carrying refs; `GET …/media/totals` — count + summed size for the current filter (the storage-bill lens); `GET …/media/:assetId` — detail incl. all refs and capture history.
- **Download route for Baseout-stored assets**: `GET /api/internal/spaces/:spaceId/media/:assetId/download` streams the object from a **new read-only R2 bucket binding on apps/server** (Workers bind R2 natively — no S3 creds; zero egress). Destination-stored assets return the provider locator (web renders "Open in {provider}") — the engine never proxies bytes it doesn't hold.
- **Retention alignment:** asset/ref rows and R2 objects follow the record/snapshot retention + cleanup rules (`server-retention-and-cleanup`) — no independent policy.

## Capabilities

### New Capabilities

- `media-index`: per-Space asset/ref persistence with dedup and lifecycle, the batched ingest route, the filter/totals/detail read API, and R2 download streaming for managed-storage assets.

### Modified Capabilities

None.

## Impact

- **App:** `apps/server` — per-Space migration, `per-space/media-sync.ts` (pure) + `space-db-pg.ts` IO, four internal routes, **new R2 bucket binding** (read-only).
- **Runbook (same-change rule):** [shared/internal/r2-setup.md](../../../shared/internal/r2-setup.md) — the engine Worker gains its first R2 surface (native binding, NOT S3 creds; the "no R2 creds in .dev.vars" rule stands untouched). Update the per-env bucket/binding matrix in this change.
- **Cross-repo contract:** media-sync body + read-API shapes — owned by THIS change; [`workflows-media-metadata`](../workflows-media-metadata/proposal.md) sends, web (future promotion of ui-only `media-library`) reads. Land this first.
- **Blockers:** PRD/Features amendment (capability row + tier); per-Space migration sequencing behind `system-per-space-db`.
- **Thumbnails deliberately deferred** — schema carries the fields; generation is its own follow-up change (real compute cost; see design Decision 4). The UI spec already renders acceptably from type glyphs.
