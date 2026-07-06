## Why

The Schema page (`/schema`, `SchemaView.astro`) has vanilla-in-view tabs — Browse, Relationships, Health, Docs, Chat — but no *visual* view of the schema. Airtable users think in diagrams: they want to see the ER graph of a base, the relationship web, and how Automations/Interfaces touch Tables/Fields. The ui-only [`visualize-automations-interfaces`](../../../) + [`field-visibility-filter`](../../../) specs define a **Visualize** tab built on a React Flow canvas with a mode menu (Data · Relationships · Automations & Interfaces) and a reusable hierarchical field-visibility filter. This change ports that tab into `apps/web`.

The Data and Relationships modes need **no new backend** — they reuse the existing `getSchema` / `getRelationships` reads. Only the Automations & Interfaces mode needs an assembled cross-entity graph, delivered by the paired [`server-schema-entity-graph`](../server-schema-entity-graph/) change via a new proxy `/api/spaces/[spaceId]/entity-graph`.

## What Changes

- A new **Visualize** tab on `/schema`, placed **after Browse** (before Relationships), rendered by a React Flow island `components/schema/SchemaCanvas.tsx` (`client:visible`, so the React Flow bundle loads only when the tab opens).
- A **mode menu** on the canvas — **Data** (ER graph), **Relationships**, and **Automations & Interfaces** — switching what the canvas draws without leaving the tab:
  - **Data** mode reuses the existing schema (`getSchema` / the SSR `fv-schema-data`) — tables as nodes, linked-record fields as edges. No new backend.
  - **Relationships** mode reuses the existing relationships (`getRelationships`) — no new backend.
  - **Automations & Interfaces** mode consumes `/api/spaces/[spaceId]/entity-graph` from [`server-schema-entity-graph`](../server-schema-entity-graph/) — typed automation/interface/page/table/field nodes with `references`/`reads`/`triggers` edges.
- Ported controls: the **`FieldsFilter.tsx`** hierarchical Base ▸ Table ▸ Field visibility filter (reusing `lib/schema-docs/field-visibility.ts`); a **`FacetFilter`** (base / node-type) control; **collapse-fields-under-table** (expand on demand); **removed-entity muting** with an **"include removed"** toggle; a **legend** for node/edge kinds.
- **Empty state + below-Growth upsell**: the A&I mode's empty state points to where Automations/Interfaces are captured; organizations **below Growth** see the upsell for that mode (per the source spec's tier gate).
- **Launch+ gating** for the tab reuses the Schema Docs tier guard on the proxy (no new capability key), like the Health and Relationships tabs.
- **No rewrite of the existing 5 vanilla tabs** (Browse/Relationships/Health/Docs/Chat) — per "don't refactor what works," Visualize is added alongside them.

## Capabilities

### New Capabilities
- `visualize-tab`: the Visualize tab on `/schema` — a React Flow canvas with a Data / Relationships / Automations & Interfaces mode menu, the hierarchical field-visibility filter, base/type facet filters, collapse-fields-under-table, removed-entity muting + include-removed toggle, node/edge legend, empty state, and below-Growth upsell for the A&I mode. Launch+ gated.

### Modified Capabilities
<!-- Adds a tab to the Schema page and one proxy route; introduces the first schema/* component family (SchemaCanvas/FieldsFilter islands + FacetFilter.astro). Reuses field-visibility.ts, getSchema, getRelationships; consumes server-schema-entity-graph for the A&I mode. No new DB/migration/capability-key. -->

## Impact

- `apps/web/src/components/schema/SchemaCanvas.tsx` — the React Flow island (ported): mode menu, dagre layout, typed nodes, three edge kinds, legend, collapse/include-removed toggles. New React island → must satisfy `apps/web/src/components/islands/islands-governance.test.ts` (islands are `.tsx` only; `.astro` here would bypass the daisyUI classification audit). If it lands under `components/schema/` rather than `components/islands/`, confirm the governance globs cover it — otherwise place islands per the carve-out.
- `apps/web/src/components/schema/FieldsFilter.tsx` — the reusable hierarchical field-visibility filter (ported), reusing [`lib/schema-docs/field-visibility.ts`](../../../apps/web/src/lib/schema-docs/field-visibility.ts) for the tri-state selection model.
- `apps/web/src/components/schema/FacetFilter.astro` — the base/node-type facet control (ported). New `components/schema/*.astro` ⇒ MUST be registered in [`component-classification.json`](../../../apps/web/src/components/component-classification.json), get a sibling `FacetFilter.stories.ts`, and a `/styleguide` entry in `apps/design` (per `apps/web/.claude/CLAUDE.md` §2.5), with **NO `<style>` block** (daisyUI/tokens only).
- `apps/web/src/lib/backup-engine.ts` — `getEntityGraph(spaceId)` client method + node/edge view types (delivered by [`server-schema-entity-graph`](../server-schema-entity-graph/); consumed here).
- `apps/web/src/pages/api/spaces/[spaceId]/entity-graph.ts` (GET) — guarded proxy for the A&I mode (reuses `guardSchemaDocsRequest`; delivered by the paired server change).
- [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — a "Visualize" radio tab after Browse, hosting the `SchemaCanvas` island (`client:visible`) with the SSR `fv-schema-data` JSON for Data mode + lazy `getRelationships` / `getEntityGraph` fetches for the other modes. If the tab body is composed as vanilla-in-view (daisyUI-direct second tier, like the existing tabs) rather than a Storybook component, add the `SchemaView.astro` entry to [`raw-markup-audit-allowlist.json`](../../../apps/web/src/components/raw-markup-audit-allowlist.json) noting the React Flow carve-out. Do **not** rewrite the existing 5 tabs.
- **Pairs with** [`server-schema-entity-graph`](../server-schema-entity-graph/) (engine graph assembly + `/entity-graph` proxy for the A&I mode).
- **Deferred follow-ups:**
  - Node click-through to a shared entity-detail sidebar (cross-tab reuse of Browse's entity panel).
  - `page → automation` **triggers** edges render on demand but stay empty until the submitted interface payloads carry the triggered-automation reference (server-side deferred).
  - Promote inline daisyUI in the mode menu / legend into Storybook components once a second call site exists.
  - Mobile-breakpoint polish of the canvas + filters.
  - No DB/migration/capability-key change.
