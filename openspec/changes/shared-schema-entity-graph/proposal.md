## Why

The Schema page's **Visualize** tab ([`apps/design/specs/10-schema.md`](../../../apps/design/specs/10-schema.md)) is gaining a mode menu — Visualize **Data** vs. Visualize **Relationships** (the UI counterpart to [`server-schema-relationships`](../server-schema-relationships/proposal.md), being designed now). Once a Space has captured Automations and Interfaces ([`shared-automations-interfaces`](../shared-automations-interfaces/proposal.md)), users have no way to *see* how those entities wire into their schema — which Tables/Fields an automation touches, which Tables/Fields a page reads, and which automations an interface page triggers. A list with tag badges answers "what does X touch"; it does not answer "show me the web." This change adds that graph.

It also closes a data gap: page→automation links (an interface button/element that runs an automation) are not captured anywhere today, so they can never be drawn. This change captures them so the graph is complete.

## What Changes

- **Entity-graph payload contract** — a typed node/edge model the engine produces: nodes are Automations, Interfaces, Pages, Tables, Fields; edges are `references` (automation→table/field), `reads` (page→table/field), and `triggers` (page/interface→automation). Removed entities stay in the payload so consumers can render history.
- **Engine read endpoint** (`apps/server`) — an `x-internal-token`-gated `/api/internal/spaces/:spaceId/entity-graph` that assembles nodes + edges from `bo_at_automations`, `bo_at_interfaces`, and `bo_at_entity_tags` in one per-Space query (optionally `?baseId`-scoped), so the client renders from a single typed payload instead of stitching list calls.
- **Capture page→automation links** — extend the entity-tag model (introduced by `shared-automations-interfaces`) to allow `target_type='automation'`: auto-extract automation references from an interface/page `definition` during intake, and accept them on the inbound API and UI tag-picker. No new table — reuses `bo_at_entity_tags` with `source_type='interface'`, `target_type='automation'`.
- **Web proxy** — an authenticated, IDOR- + capability-gated `/api/spaces/[spaceId]/entity-graph` route fronting the engine endpoint.
- The **Visualize "Automations & Interfaces" graph UI** (the React Flow mode, node/edge rendering, filters, legend, click-through) is the paired **UI-only** change in the `ui-only` repo — `visualize-automations-interfaces` — which consumes this proxy.

**Dependency:** builds directly on [`shared-automations-interfaces`](../shared-automations-interfaces/proposal.md) (entity-tag model, automations/interfaces rows, engine broker, web proxy, Growth+ capability). That change should land first; this one extends its tagging with the automation target and adds the graph read.

## Capabilities

### New Capabilities
- `schema-entity-graph`: the entity-graph payload contract (typed nodes + edge kinds, removed entities retained) and the engine read endpoint + `apps/web` proxy that assemble and serve it. (The Visualize graph UI is the paired `ui-only` change.)
- `entity-automation-links`: capturing and storing interface/page→automation references as `bo_at_entity_tags` with `target_type='automation'`, via definition extraction during intake and via the inbound API / UI tag-picker.

### Modified Capabilities
<!-- No archived capability in openspec/specs/ changes. This change extends the entity-tag
     behavior introduced by the unstarted shared-automations-interfaces change; that extension
     is expressed as ADDED requirements here and cross-referenced, not as a delta against an
     unarchived spec. -->

## Impact

- **Depends on / extends** `shared-automations-interfaces` (entity-tags, automations/interfaces broker + proxy, capability gate).
- `apps/server` — new `lib/per-space/entity-graph.ts` (assemble nodes/edges) + `pages/api/internal/spaces/entity-graph.ts` + route registration; extend the tag auto-extraction helper to emit `target_type='automation'` links from interface definitions; allow `target_type='automation'` in validation.
- `apps/api` — accept `target_type='automation'` link entries on the interface payload (same auth/tier/validation path).
- `apps/web` — `src/lib/backup-engine.ts` graph method; IDOR- + capability-gated `/api/spaces/[spaceId]/entity-graph` proxy. (The Visualize React Flow graph UI is the paired `ui-only` change `visualize-automations-interfaces`.)
- **Paired UI-only change**: `ui-only` `visualize-automations-interfaces` (the Visualize graph mode, node/edge rendering, filters, legend, click-through).
- **No new DB table or migration** — reuses `bo_at_entity_tags` (its `target_type` is free-text); `target_type='automation'` is an application-layer value.
- **Security review points:** new internal read surface (`x-internal-token` + IDOR on `spaceId`), new web proxy (session ownership + Growth+ gate); read-only graph assembly — no new write surface beyond the additive `target_type='automation'` accepted on the existing intake paths.
