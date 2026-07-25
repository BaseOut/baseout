# Tasks

## 0. Blockers

- [ ] 0.1 PRD/Features amendment: media-library capability row + tier (recommend: rides the Data capability / dynamic mode — Dan confirms).
- [ ] 0.2 Per-Space migration sequencing behind `system-per-space-db`.

## 1. Contract + schema

- [ ] 1.1 Define media-sync body + read-API shapes in `per-space/media-sync.ts` — single source for workflows + web.
- [ ] 1.2 Migration: `bo_at_assets` + `bo_at_asset_refs` per the proposal sketch (content-type class column at write time; keyset + totals indexes).

## 2. Pure modules (TDD)

- [ ] 2.1 Batch extraction/validation; asset upsert by checksum; ref upsert by attachment id; per-record `complete` deletion rule; zero-ref flagging.
- [ ] 2.2 Content-type classing map (+ extension fallback → `other`).

## 3. Routes + R2 binding

- [ ] 3.1 `POST media-sync`; `GET media` (filters/pagination) + `GET media/totals` + `GET media/:assetId` — INTERNAL_TOKEN + Space scoping.
- [ ] 3.2 Read-only `r2_buckets` binding on apps/server + download streaming route; **update `shared/internal/r2-setup.md` (per-env bucket/binding matrix) in this change** — native binding, no S3 creds, the `.dev.vars` rule untouched.
- [ ] 3.3 Integration tests: dedup; lifecycle incl. incremental safety; filters/totals; download happy path + cross-space denial + BYOS non-proxy answer.

## 4. Retention + verification

- [ ] 4.1 Fold zero-ref assets + R2 objects into the retention/cleanup deletion plan (`server-retention-and-cleanup`).
- [ ] 4.2 Suites + `tsc --noEmit` green; land BEFORE `workflows-media-metadata`; shape cross-check with ui-only `media-library` fixtures.
