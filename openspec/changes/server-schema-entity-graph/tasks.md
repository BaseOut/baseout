## Status

PROPOSED — not yet implemented. Engine-side read for the Visualize "Automations &
Interfaces" mode: a pure node/edge graph builder + one internal route + a web proxy
+ one client method. Read-only; no Trigger.dev task, no DB/migration/capability-key
change. Consumes [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/);
pairs with [`web-schema-visualize`](../web-schema-visualize/).

---

## 1. Graph builder (pure, test-first)

- [ ] 1.1 Write `apps/server/src/lib/per-space/entity-graph.test.ts` FIRST: `buildEntityGraph({ automations, interfaces, tables, fields })` emits `table`/`field` nodes from schema; `automation` nodes + `references` edges to referenced Tables/Fields; `interface`/`page` nodes + `reads` edges; `triggers` edges from page/interface → automation. Assert node/edge `kind`, `source`/`target`, and `status` fields.
- [ ] 1.2 Test removed-endpoint handling: a reference to a soft-deleted Table/Field re-points at a `status:'removed'` node (not dropped); edges touching a removed endpoint inherit `status:'removed'`.
- [ ] 1.3 Test empty/degenerate cases: no automations/interfaces → only schema nodes (or empty); an automation referencing an unknown id → removed node, not a crash.
- [ ] 1.4 Implement `apps/server/src/lib/per-space/entity-graph.ts` — the pure builder (injected plain data, no DB handle) until 1.1–1.3 are green.

## 2. Internal route (test-first)

- [ ] 2.1 Write `apps/server/src/pages/api/internal/spaces/entity-graph.test.ts` FIRST: `405` on non-GET; `400` on bad `spaceId`; `409 space_db_not_ready` when the Space isn't active; `501 backend_not_implemented` for non-`managed_pg`; `200 { ok, nodes, edges }` on success. Mirror `relationships-overview` test shape.
- [ ] 2.2 Implement `apps/server/src/pages/api/internal/spaces/entity-graph.ts` — `resolveSpaceDb` → active + `managed_pg` guard → `ensureSpaceSchemaCurrent` → `withSpaceSchema` load of submitted Automations/Interfaces + Base/Table/Field rows → `buildEntityGraph(...)` → `jsonResponse({ ok:true, nodes, edges }, 200)`. Mirror `relationships-overview.ts` exactly.
- [ ] 2.3 Register `ENTITY_GRAPH_RE = /^\/api\/internal\/spaces\/([^/]+)\/entity-graph$/` in `apps/server/src/index.ts` and dispatch to the handler (token gate already applied by middleware for `/api/internal/`).

## 3. Web client + proxy (test-first)

- [ ] 3.1 Write `apps/web/src/pages/api/spaces/[spaceId]/entity-graph.test.ts` FIRST: unauthenticated → guard's 401/403; non-owner → 403 (IDOR); below-tier → 403 with the upgrade code; engine unconfigured → 503 `server_misconfigured`; success → `{ ok, nodes, edges }`; error codes map through `schemaDocsErrorStatus`. Mirror `relationships.test.ts`.
- [ ] 3.2 Add `getEntityGraph(spaceId)` to `apps/web/src/lib/backup-engine.ts` (GET `/api/internal/spaces/:spaceId/entity-graph`) + `EntityGraphNodeView` / `EntityGraphEdgeView` / `GetEntityGraphResult` view types, mirroring `getRelationships`.
- [ ] 3.3 Implement `apps/web/src/pages/api/spaces/[spaceId]/entity-graph.ts` (GET) — `guardSchemaDocsRequest` (auth + IDOR + tier), 503 when the engine binding/token is unset, `schemaDocsErrorStatus` mapping. Mirror `relationships.ts` structure.

## 4. Cross-app contract check

- [ ] 4.1 Confirm the payload shape (`{ ok, nodes, edges }`, node/edge `kind` + `status` enums) matches what [`web-schema-visualize`](../web-schema-visualize/)'s `SchemaCanvas` Automations & Interfaces mode expects; if it shifts, update both this change and the web change.

## 5. Verification

- [ ] 5.1 Engine: `pnpm --filter @baseout/server test entity-graph` green (builder + route). No stray `console.*`.
- [ ] 5.2 Web: `pnpm --filter @baseout/web test entity-graph` green (proxy). No stray `console.*`.
- [ ] 5.3 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server build` green; `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web build` green.
- [ ] 5.4 Human smoke: on a `managed_pg` Space with submitted Automations/Interfaces, deploy the engine (`--remote`) and hit `/api/spaces/:id/entity-graph` through web local → nodes for automations/interfaces/pages/tables/fields + `references`/`reads` edges; a removed Table shows `status:'removed'`; a non-entitled org gets 403.

## Deferred follow-ups

- [ ] `page → automation` **triggers** edges populate only once interface payloads carry the triggered-automation reference — ship the edge kind now, backfill the data later.
- [ ] Server-side per-base filtering of the payload (currently client-side via `FacetFilter`), gated on real payload sizes.
- [ ] A materialized/cached graph if read-time assembly ever exceeds the Worker wall-clock budget on large Spaces.
- [ ] Cross-base linked-record edges — out of scope here (that's the Data ER mode reusing `getSchema`).
