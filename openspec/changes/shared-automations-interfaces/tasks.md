## 1. Reconcile superseded changes & specs

- [ ] 1.1 Re-scope or archive `server-automations-interfaces-docs` — drop the master-DB `submitted_entities` design; carve out custom-documentation intake into a fresh future change; cross-reference this change in its proposal
- [ ] 1.2 Narrow/close `workflows-automations-interfaces-docs` (no run-time collection of automations/interfaces; they are intake-only) and cross-reference here
- [ ] 1.3 Update `shared/Baseout_Features.md` §1 naming dictionary (Entity Tag, Automation, Interface, Page) and add a flag note on the §4.2 (Launch+) vs PRD §2.9 (Growth+) tier divergence

## 2. Per-Space schema (`packages/db-schema`)

- [ ] 2.1 Add `parent_interface_id` column to `bo_at_interfaces` in `src/space/pg.ts`, `sqlite.ts`, and `pg-ddl.ts`
- [ ] 2.2 Add `bo_at_entity_tags` table (source_type, source_id, target_type, target_id, added_via + indexes + unique) across pg/sqlite/pg-ddl
- [ ] 2.3 Bump `SPACE_SCHEMA_VERSION`
- [ ] 2.4 Update `space-schema-parity` + `space-pg-ddl-parity` tests; run `pnpm --filter @baseout/db-schema test` green

## 3. Shared payload contract (`packages/shared`)

- [ ] 3.1 Write failing tests for the automation + interface Zod schemas (required scalars, `interface|page` enum, page-requires-parent, opaque `definition`)
- [ ] 3.2 Implement the shared Zod schemas + exported TS types; make tests green

## 4. Tag auto-extraction (engine helper)

- [ ] 4.1 Write failing tests for the walker using both fixtures — automations (`trigger.table`, `actions[].table`, `actions[].fields`, condition `field`; ignore `{tokens}`) and interfaces (page `sourceTable`, `detailFieldsShown[]`); assert resolves names→ids and skips unresolved
- [ ] 4.2 Implement the config-driven extraction walker (per-entity-type reference-path map); make tests green

## 5. Engine broker (`apps/server`)

- [ ] 5.1 Write failing integration tests for `lib/per-space/automations.ts` CRUD (upsert by entity id, auto-tag on write, manual-tag preservation, soft delete retaining row+tags, re-submission reactivation) using Miniflare + local PG
- [ ] 5.2 Implement `lib/per-space/automations.ts` and `lib/per-space/interfaces.ts` (nested→flat normalization per D4a, id mapping, page-parent validation) on `withSpaceSchema`
- [ ] 5.3 Add `x-internal-token`-gated routes `pages/api/internal/spaces/{automations,interfaces}.ts` (GET/POST/PUT/DELETE) + register in route index
- [ ] 5.4 Integration tests for the internal routes (auth gate, IDOR on spaceId, validation) green

## 6. Inbound REST API (`apps/api`)

- [ ] 6.1 Write failing tests: Org-API-token auth, token→Space ownership, Growth+ gate, Zod validation, HMAC forward to engine (engine mocked at the boundary)
- [ ] 6.2 Implement `POST/PUT/DELETE /v1/spaces/:spaceId/{automations,interfaces}` with auth + tier gate + validation + HMAC service-token forward; make tests green
- [ ] 6.3 Contract test asserting the API payload and the UI proxy payload produce equivalent engine calls

## 7. Web proxy + capability (`apps/web`)

- [ ] 7.1 Add `automationsInterfaces` (`none|manual`) to `src/lib/capabilities/tier-capabilities.ts` from cached Stripe metadata + unit test
- [ ] 7.2 Add typed engine-client methods in `src/lib/backup-engine.ts`
- [ ] 7.3 Write failing tests then implement authenticated, IDOR- + capability-gated `/api/spaces/[spaceId]/{automations,interfaces}` proxy routes

> **Schema tab UI is out of scope** — specced + built in the paired `ui-only` change `automations-interfaces-tabs` (listings, forms, tag-picker, tag surfacing, upsell), consuming the group-7 proxy routes.

## 8. Verification & wrap-up

- [ ] 8.1 Full `pnpm typecheck` + `pnpm build` across touched apps green; `db:check` clean
- [ ] 8.2 Security review points confirmed (inbound API auth+tier+Zod, internal token + IDOR, HMAC forward path) and noted in the PR
- [ ] 8.3 `openspec validate shared-automations-interfaces` green; commit with §3.8 Verification section
