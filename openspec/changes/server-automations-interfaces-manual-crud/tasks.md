## Status

PROPOSED — not yet implemented. The manual-entry-first engine slice for Automations &
Interfaces (see [`proposal.md`](./proposal.md) for the carve-out rationale + layering
contract with the deferred [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/) funnel).

Schema-page sequencing: after the Visualize tab (Data+Relationships modes), before the
web A&I tabs (`web-automations-interfaces-tabs`) and the entity-graph
(`server-schema-entity-graph`), both of which consume this slice.

---

## 1. Per-Space schema v6

- [ ] 1.1 `packages/db-schema/src/space/pg.ts` — add `bo_at_entity_tags` (entity_kind CHECK automation|interface, entity_id uuid, target_type CHECK table|field, target_id text, source CHECK auto|manual DEFAULT manual, added_at; UNIQUE (entity_kind, entity_id, target_type, target_id); index by (entity_kind, entity_id) and by (target_type, target_id)); add `parentId` to `interfaces`; add partial UNIQUE `(base_id, airtable_entity_id) WHERE airtable_entity_id IS NOT NULL` to both entity tables. Mirror ALL of it in `sqlite.ts` (parity test enforces lockstep).
- [ ] 1.2 Bump `SPACE_SCHEMA_VERSION` 5 → 6 in `packages/db-schema/src/space/index.ts` (+ version-history comment). Regenerate DDL via `scripts/gen-space-pg-ddl.mjs`.
- [ ] 1.3 `pg-ddl-upgrade.ts` — hand-append `ALTER TABLE "bo_at_interfaces" ADD COLUMN IF NOT EXISTS "parent_id" uuid` (the idempotent mapper only rewrites CREATE TABLE/INDEX); update the file's invariant comment. Parity/ddl tests green.

## 2. Engine io module — TDD

- [ ] 2.1 RED: `automations-interfaces-io` tests (real local PG + `withSpaceSchema`): list by kind (+ `baseId` / `includeRemoved` filters) joins tags with `targetRemoved` via `flagRemovedTags`; create (sets `submitted_via='manual_form'`, `first_seen_at=last_seen_at=now()`, `status='active'`, inserts manual tags) + duplicate `airtable_entity_id` → `duplicate_entity`; update (scalars + full-replace of `source='manual'` tags only — seeded `auto` rows untouched); remove (soft: `status='removed'`, `last_seen_at=now()`); page-parent validation (page requires parentId that exists, is `type='interface'`, same base).
- [ ] 2.2 GREEN: `apps/server/src/lib/per-space/automations-interfaces-io.ts` — one module, `kind: 'automation'|'interface'` parameter.

## 3. Engine routes — TDD

- [ ] 3.1 RED: route tests mirroring `relationships-overview` / `relationships-mutate` — 405, 400 invalid params/body, 409 `space_db_not_ready`, 501 `backend_not_implemented`, 200 read `{ ok, automations|interfaces }`, mutate actions incl. 409 `duplicate_entity` + 400 page-parent, 404 `not_found` on update/remove of unknown id.
- [ ] 3.2 GREEN: `pages/api/internal/spaces/automations.ts`, `automations-mutate.ts`, `interfaces.ts`, `interfaces-mutate.ts` + regex registration in `apps/server/src/index.ts`.

## 4. Web client + proxies — TDD

- [ ] 4.1 RED→GREEN: `backup-engine.ts` — `AutomationView` / `InterfaceView` / `EntityTagView` + `getAutomations(spaceId, baseId?, includeRemoved?)` / `mutateAutomation(spaceId, body)` / `getInterfaces` / `mutateInterface`, mirroring `getRelationships` / `mutateRelationship`.
- [ ] 4.2 RED→GREEN: `pages/api/spaces/[spaceId]/automations.ts` + `interfaces.ts` — GET→read, POST→`create`, PATCH→`update`, DELETE→`remove`; `guardSchemaDocsRequest` (auth + IDOR + tier per the web change's Growth+ decision) + CSRF on mutations + `schemaDocsErrorStatus` + 503 unconfigured. Co-located tests.

## 5. Verification + human smoke

- [ ] 5.1 Targeted server suites green (io + routes + parity/ddl); `pnpm --filter @baseout/server exec tsc --noEmit` 0 errors. Web: new client/proxy tests green; `typecheck` + `build` green. No stray `console.*`.
- [ ] 5.2 Smoke on the provisioned dev Space (local engine :8787 or deploy:dev): create an automation with a table tag via `curl` → GET lists it with the tag; duplicate create → 409; update replaces manual tags; remove → `status='removed'`, hidden without `includeRemoved`; page without parentId → 400. Verify v6 self-heal: first per-Space access after deploy runs the upgrade (schema read still green).

## Deferred (owned by the umbrella change)

- Master `submitted_entities` ledger + apps/api inbound endpoints + Airtable script/automation generators + backup-run reconcile (Phase F contract pinned in this change's proposal) + version history/diffing.
