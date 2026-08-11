## Why

The web Visualize tab is gaining an **Automations & Interfaces** graph mode ([`web-schema-visualize`](../web-schema-visualize/)) that shows "the web": which Tables/Fields an Automation references, which Tables/Fields an Interface page reads, and which Automations a page/interface triggers. The Data and Relationships modes of that tab reuse existing reads (`getSchema` / `getRelationships`) — no new backend. But the Automations & Interfaces mode needs a **cross-entity node/edge graph** that the engine assembles from the submitted Automations + Interfaces captured by [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/), joined to the Base/Table/Field schema already in the per-Space DB.

Nothing assembles that graph today. This change adds a read-time graph builder in the engine and exposes it on a new internal route, consumed by a thin web proxy `/api/spaces/[spaceId]/entity-graph`. It is purely a read/visualization surface — no writes, no Trigger.dev task, no new capability key.

## What Changes

- **Graph assembly (read-time, in the Worker).** A pure builder walks a Space's submitted Automations + Interfaces (from `submitted_entities`, per [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/)) and the per-Space Base/Table/Field schema, emitting a typed **node/edge graph**:
  - **Node kinds:** `automation`, `interface`, `page`, `table`, `field`.
  - **Edge kinds:** `automation → table/field` (**references**), `page → table/field` (**reads**), and `page/interface → automation` (**triggers**).
    - **Cross-ref (server-interfaces-normalize, 2026-07-20):** assemble the `page → table/field` **reads** edges from the normalized `bo_at_page_tables` / `bo_at_page_fields` link tables (indexed both directions), NOT by parsing a page's `definition` blob — the field/table detail no longer lives there. `page` / `interface` / `form` nodes come from `bo_at_pages` / `bo_at_interfaces` / `bo_at_forms`.
  - Each node carries `status` (`active` / `removed`) so the web can render soft-deleted entities muted with history intact.
- **New internal route** `GET /api/internal/spaces/:spaceId/entity-graph` — returns `{ ok, nodes, edges }` for the Space. Token-gated by middleware (path begins `/api/internal/`), IDOR- and readiness-guarded exactly like `relationships-overview` (`resolveSpaceDb` → `managed_pg` check → `ensureSpaceSchemaCurrent` → `withSpaceSchema`).
- **New web proxy** `GET /api/spaces/[spaceId]/entity-graph` — authenticated, IDOR- and tier-gated via `guardSchemaDocsRequest`; 503 when the engine binding/token is unconfigured; `schemaDocsErrorStatus` mapping. Reuses the exact pattern of `relationships.ts`.
- **New web client method** `getEntityGraph(spaceId)` on the backup-engine client (`backup-engine.ts`), mirroring `getRelationships` (view types for nodes/edges + result).
- **No new backend for Data / Relationships modes** — those Visualize modes reuse existing `getSchema` / `getRelationships`. Only the Automations & Interfaces mode consumes this route.
- A short `design.md` documents the graph data model (node kinds, edge kinds, status).

## Capabilities

### New Capabilities
- `schema-entity-graph`: the engine-assembled cross-entity node/edge graph for the Visualize "Automations & Interfaces" mode — five node kinds (automation/interface/page/table/field), three edge kinds (references/reads/triggers), per-node active/removed status, read-time assembly in the Worker, exposed on `/api/internal/spaces/:spaceId/entity-graph` and proxied to web via `/api/spaces/[spaceId]/entity-graph`, tier-gated by the Schema Docs level.

### Modified Capabilities
<!-- Adds a read-only internal route + a web proxy + one client method; consumes server-automations-interfaces-docs. No DB/migration/capability-key change (schema-read/relationships-overview already own the per-Space tables this reads). -->

## Impact

- `apps/server/src/lib/per-space/entity-graph.ts` — pure graph builder (nodes + edges from submitted Automations/Interfaces + Base/Table/Field schema). Unit-tested in isolation.
- `apps/server/src/pages/api/internal/spaces/entity-graph.ts` — internal route handler, mirroring [`relationships-overview.ts`](../../../apps/server/src/pages/api/internal/spaces/relationships-overview.ts) (guards + `withSpaceSchema` read).
- `apps/server/src/index.ts` — register `ENTITY_GRAPH_RE` + dispatch to the handler (alongside `spacesRelationshipsOverviewHandler`).
- `apps/web/src/lib/backup-engine.ts` — `getEntityGraph(spaceId)` + node/edge view types + `GetEntityGraphResult`, mirroring `getRelationships`.
- `apps/web/src/pages/api/spaces/[spaceId]/entity-graph.ts` (GET) — guarded proxy, mirroring [`relationships.ts`](../../../apps/web/src/pages/api/spaces/[spaceId]/relationships.ts).
- **Pairs with** [`web-schema-visualize`](../web-schema-visualize/) (the Visualize tab that consumes this route for its Automations & Interfaces mode).
- **Depends on** [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/) for the captured Automations/Interfaces (`submitted_entities`) the graph is assembled from.
- **Deferred follow-ups:**
  - `page → automation` **triggers** edges are empty until interface pages carry their triggered-automation reference in the submitted payload — the edge kind ships and renders on demand; the graph is useful from day one on `references` / `reads`.
  - Per-base filtering server-side (the web currently filters client-side via `FacetFilter`); revisit if graphs get large enough that a full-Space payload is too heavy.
  - Cross-base edges (linked-record spanning bases) — out of scope; this graph is Automations/Interfaces-centric, not the ER graph (that's the Data mode reusing `getSchema`).
  - No DB/migration/capability-key change.
