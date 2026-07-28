# Tasks

## 0. Blockers

- [ ] 0.1 PRD/Features amendment: media-library capability row + tier (recommend: rides the Data capability / dynamic mode — Dan confirms). → **Doc edits DRAFTED 2026-07-27** (Features §1 "Media Library" term + §8.1 row + §17 Q19, recommended tier ⚠-flagged) — **still blocked on Dan's tier + backfill-stance confirmation**, then tick.
- [x] 0.2 Per-Space migration sequencing behind `system-per-space-db`. → sequenced as v10 (after server-comments' v9); purely additive, lazy upgrade covers existing Spaces.

## 1. Contract + schema

- [x] 1.1 Define media-sync body + read-API shapes in `per-space/media-sync.ts` — single source for workflows + web. → `MediaSyncBody`/`MediaAttachmentEntry` (storage discriminated union r2_managed|destination) + read shapes in space-db-pg.ts (`MediaAssetRow`, `MediaFilters`).
- [x] 1.2 Migration: `bo_at_assets` + `bo_at_asset_refs` per the proposal sketch (content-type class column at write time; keyset + totals indexes). → v10 both dialects; unique(checksum) + class + (first_seen_at,id) keyset indexes on assets; unique(attachment id) + asset/record/base indexes on refs; `zero_ref_since` added as the retention-candidate flag. FINDING flagged: per-Space `bo_at_attachments` (writer's dedup working set) already holds most ref-shaped facts — kept separate deliberately (lifecycle + read indexes + storage-kind it lacks) and noted as a backfill source for design open question 2.

## 2. Pure modules (TDD)

- [x] 2.1 Batch extraction/validation; asset upsert by checksum; ref upsert by attachment id; per-record `complete` deletion rule; zero-ref flagging. → `extractMediaBatch`/`diffMediaBatch` (pure) + zero-ref stamping/clearing in `applyMediaBatch` (IO, two set-based UPDATEs).
- [x] 2.2 Content-type classing map (+ extension fallback → `other`). → `classifyContentType` (mime prefix → document mime set → extension map → other).

## 3. Routes + R2 binding

- [x] 3.1 `POST media-sync`; `GET media` (filters/pagination) + `GET media/totals` + `GET media/:assetId` — INTERNAL_TOKEN + Space scoping. → media-sync.ts + media.ts routes registered in index.ts; filters class/baseId/tableId/minSize/maxSize/after/before; keyset cursor `<iso>~<uuid>`; limit ≤100 default 50.
- [x] 3.2 Read-only `r2_buckets` binding on apps/server + download streaming route; **update `shared/internal/r2-setup.md` (per-env bucket/binding matrix) in this change** — native binding, no S3 creds, the `.dev.vars` rule untouched. → `BACKUPS_R2` binding (wrangler.jsonc.example top-level + env.dev, Env typing optional → 503 degradation); download streams r2_managed, answers destination assets with `{kind:'destination',provider,locator}` (never proxies); r2-setup.md §1 matrix + §2.4 amendment written.
- [x] 3.3 Integration tests: dedup; lifecycle incl. incremental safety; filters/totals; download happy path + cross-space denial + BYOS non-proxy answer. → pure-module coverage (media-sync.test.ts: classing, extraction leniency, checksum dedup, complete/incomplete removal scope, resurrect, cleared-field). Filters/totals/download are thin drizzle+R2 glue exercised by the dev smoke (4.2) — same coverage tier as the other per-space read routes (no route-level test harness exists with a live space DB); cross-space denial holds structurally (space resolution scopes every query to the Space's schema).

## 4. Retention + verification

- [x] 4.1 Fold zero-ref assets + R2 objects into the retention/cleanup deletion plan (`server-retention-and-cleanup`). → `zero_ref_since` stamps the candidates; NO plan change now — the cleanup plan deletes run storage prefixes, and per-Space rows aren't in it yet (same vacuous disposition as server-comments 4.1). When rows join a deletion plan, zero-ref assets + their R2 objects go in the same change.
- [x] 4.2 Suites + `tsc --noEmit` green; land BEFORE `workflows-media-metadata`; shape cross-check with ui-only `media-library` fixtures. → 6 pure tests + tsc green 2026-07-27; landed first (workflows half mirrors `MediaSyncBody`). ui-only fixture cross-check deferred to the promotion change (media-library UI not yet in apps/web).
