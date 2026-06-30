## 1. Precondition

- [ ] 1.1 Confirm `shared-automations-interfaces` is applied (entity-tags model, automations/interfaces broker + proxy, Growth+ capability); if its tag shape shifted, reconcile this change's read/extraction against it

## 2. Capture interface/page → automation links

- [ ] 2.1 Write failing tests: extraction walker emits an `added_via='auto'` automation-target tag from an interface `definition` automation reference; unresolvable refs skipped; manual links preserved
- [ ] 2.2 Extend the shared extraction walker with the automation reference path; allow `target_type='automation'` in engine + shared Zod validation; make tests green
- [ ] 2.3 `apps/api`: accept automation link entries on the interface payload (same auth/tier/validation path) + tests
- [ ] 2.4 `apps/web`: add automation targets to the page tag-picker; manual automation link round-trips through the proxy + tests

## 3. Engine graph assembly (`apps/server`)

- [ ] 3.1 Write failing integration tests for `lib/per-space/entity-graph.ts` (nodes for automation/interface/page/table/field; edges `references`/`reads`/`triggers`; removed entities included; `?baseId` scoping) on Miniflare + local PG
- [ ] 3.2 Implement `lib/per-space/entity-graph.ts` — one per-Space read joining `bo_at_automations` + `bo_at_interfaces` + `bo_at_entity_tags` (+ tables/fields for labels), type-namespaced node ids
- [ ] 3.3 Add `x-internal-token`-gated `pages/api/internal/spaces/entity-graph.ts` + register route; tests for auth gate, IDOR on `spaceId`, baseId filter

## 4. Web read path (`apps/web`)

- [ ] 4.1 Add typed `getEntityGraph(spaceId, baseId?)` to `src/lib/backup-engine.ts`
- [ ] 4.2 Write failing tests then implement authenticated, IDOR- + Growth+-gated `/api/spaces/[spaceId]/entity-graph` proxy route

> **Visualize graph UI is out of scope** — specced + built in the paired `ui-only` change `visualize-automations-interfaces` (React Flow mode, node/edge rendering, filters, legend, click-through), consuming the group-4 proxy.

## 5. Verification & wrap-up

- [ ] 5.1 Full `pnpm typecheck` + `pnpm build` across touched apps green
- [ ] 5.2 Security review points confirmed (internal token + IDOR on the read endpoint, web proxy ownership + Growth+ gate) and noted in the PR
- [ ] 5.3 `openspec validate shared-schema-entity-graph` green; commit with §3.8 Verification section
