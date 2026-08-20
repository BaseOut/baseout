## Status

IMPLEMENTED — engine + web proxy prerequisite for Schema Automations/Interfaces tabs
(Phase 9). Manual-entry-first slice; see [`proposal.md`](./proposal.md).

**Schema note (2026-08-20):** tasks originally said SPACE_SCHEMA_VERSION 5→6 +
`parentId` on `bo_at_interfaces`. The repo had already advanced past that
(`SPACE_SCHEMA_VERSION` was 13; `server-interfaces-normalize` split apps/pages).
This change ships **v13→v14**: `bo_at_entity_tags` + partial UNIQUEs on
automations/interfaces/pages. Page→parent uses existing `bo_at_pages.interface_id`
(API still exposes `parentId`). No `parent_id` column on `bo_at_interfaces`.

Schema-page sequencing: after the Visualize tab (Data+Relationships modes), before the
web A&I tabs (`web-automations-interfaces-tabs`) and the entity-graph
(`server-schema-entity-graph`), both of which consume this slice.

---

## 1. Per-Space schema v6 → shipped as v14

- [x] 1.1 `packages/db-schema/src/space/pg.ts` — add `bo_at_entity_tags` (entity_kind automation|interface, entity_id uuid, target_type table|field, target_id text, source auto|manual DEFAULT manual, added_at; UNIQUE (entity_kind, entity_id, target_type, target_id); indexes by entity and by target); partial UNIQUE `(base_id, airtable_entity_id) WHERE airtable_entity_id IS NOT NULL` on automations + interfaces + pages. Page parent remains `bo_at_pages.interface_id` (no `parentId` on interfaces — normalize already owns that). Mirrored in `sqlite.ts`.
- [x] 1.2 Bump `SPACE_SCHEMA_VERSION` 13 → 14 in `packages/db-schema/src/space/index.ts` (+ version-history comment). Squash-regenerated migrations + `scripts/gen-space-pg-ddl.mjs`.
- [x] 1.3 `pg-ddl-upgrade.ts` — invariant comment updated (v14 additive; no hand ALTER for parent_id). Parity/ddl tests green (44 tables).

## 2. Engine io module — TDD

- [x] 2.1 RED: `automations-interfaces-io` tests (node-pg project + `RUN_DB_TESTS=1` against reachable PG via withSpaceSchema-shaped tx): list/create/update/remove; page-parent validation; manual tags only on update. Soft-skips when DATABASE_URL unreachable.
- [x] 2.2 GREEN: `apps/server/src/lib/per-space/automations-interfaces-io.ts` — one module covering both kinds; interfaces map apps→`type=interface`, pages→`type=page` + `parentId`.

## 3. Engine routes — TDD

- [x] 3.1 RED: route tests mirroring relationships — 401/405/400 guards for automations + interfaces read/mutate.
- [x] 3.2 GREEN: `automations.ts`, `automations-mutate.ts`, `interfaces.ts`, `interfaces-mutate.ts` + regex registration in `apps/server/src/index.ts`.

## 4. Web client + proxies — TDD

- [x] 4.1 RED→GREEN: `backup-engine.ts` — `AutomationView` / `InterfaceView` / `EntityTagView` + `getAutomations` / `mutateAutomation` / `getInterfaces` / `mutateInterface`.
- [x] 4.2 RED→GREEN: `pages/api/spaces/[spaceId]/automations.ts` + `interfaces.ts` — GET/POST/PATCH/DELETE; `guardSchemaDocsRequest` + `schemaDocsErrorStatus` + 503 unconfigured. Co-located tests.

## 5. Verification + human smoke

- [x] 5.1 Targeted suites green: db-schema 120; server workers route guards 25 (incl. new A&I); web client+proxy 18; server `tsc --noEmit` clean. No stray `console.*` in change files.
- [ ] 5.2 Smoke on the provisioned dev Space (local engine :8787 or deploy:dev): create an automation with a table tag via `curl` → GET lists it with the tag; duplicate create → 409; update replaces manual tags; remove → `status='removed'`, hidden without `includeRemoved`; page without parentId → 400. Verify v14 self-heal: first per-Space access after deploy runs the upgrade (schema read still green).

## Deferred (owned by the umbrella change)

- Master `submitted_entities` ledger + apps/api inbound endpoints + Airtable script/automation generators + backup-run reconcile (Phase F contract pinned in this change's proposal) + version history/diffing.
- UI tabs (`web-automations-interfaces-tabs` §2–3) — Drawer already exists from Backups promotion; Automations/Interfaces remain SoonTabs until that follow-up.
