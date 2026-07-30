# server-base-collaborators — Tasks

## 1. Fixtures

- [ ] 1.1 Capture live `GET /v0/meta/bases/{baseId}?include=...` payloads from a dev base (with and without interface collaborators, group collaborators, invite links) and commit as fixtures; capture one `packages` block and record its shape in design.md

## 2. Schema (packages/db-schema)

- [ ] 2.1 Add `bo_at_collaborators` and `bo_at_invite_links` to `space/sqlite.ts`, `space/pg.ts`, `space/pg-ddl.ts` per the registry requirements (unique keys with empty-string-normalized `interface_id`)
- [ ] 2.2 Per-Space schema-version bump + migration atop `system-per-space-db`
- [ ] 2.3 Confirm where base-registry stamps land (`at_bases` master-side vs per-Space base row); add `workspace_id` / `airtable_created_time` / `own_permission_level` columns where missing, mirroring per CLAUDE.md §5.3 if master-side

## 3. Sync module (apps/server, test-first)

- [ ] 3.1 Pure ingestion module: canonical-blocks-first parsing (individual/group × base/workspace), interface collaborators + interface invite links, deprecated-block fallback that cannot double-ingest (fixtures from 1.1)
- [ ] 3.2 Diff module: full-state replace semantics — upsert observed, soft-delete absent, resurrect reappearing, permission-change in place; no deletion diffing on skipped/failed captures
- [ ] 3.3 `POST /api/internal/spaces/collaborators-sync` route: INTERNAL_TOKEN gate, validation, wiring to 3.1/3.2, base-registry stamps, raw/packages retention; route-level contract tests

## 4. Close out

- [ ] 4.1 Integration test: fixture capture → rows in both tables → mutated re-capture → revocation soft-deletes + permission update + invite-link expiry handling
- [ ] 4.2 Hand the capture contract (request body shape + per-base include list) to `workflows-base-collaborators`; cross-reference proposals
- [ ] 4.3 Flag to Dan: PRD/Features amendment (collaborator + invite-link entity rows, tier; recommendation: capture rides record backup, governance surfacing stays V2)
