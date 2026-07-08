## Status

PROPOSED — engine dependency CLEARED 2026-07-07 by `server-schema-read-enrichment`:
the schema payload now carries `linkedTableId` / `allowsMultiple` / `inverseFieldId`
(+ formula/lookup config and annotations), so Data-mode edges are drawable. The
`/schema` shell now renders a soon-gated Visualize panel (`web-schema-round3-shell`,
landed `09949d3` — tabs are per-file components under `views/schema/`; this change
replaces the `SoonTab.astro` Visualize entry with a `VisualizeTab.astro` hosting the
island). Per-table `health` remains optional/uncovered.

**Buildable today:** the **Data** and **Relationships** modes have zero remaining
backend dependencies (enriched `getSchema` + existing `getRelationships`). Only the
**Automations & Interfaces** mode waits on
[`server-schema-entity-graph`](../server-schema-entity-graph/) (0/19, unbuilt) — it
can ship behind its empty state and light up when the engine route lands.
Schema-page sequencing: this slice follows the Changelog tab UI (smallest — its data
path is already live) per the maintainer's call.

**Original blocker (2026-07-06, resolved) — Data (ER) mode needs engine schema enrichment.** The graph's whole
value is drawing linked-record edges between tables, but this repo's engine
schema payload (`GetSchemaResult` → `SchemaEntityField` in
`apps/web/src/lib/backup-engine.ts`) exposes only `fieldId/tableId/baseId/name/
type/isPrimary/description/status` — **no `linkedTableId`** (the linked-record
target) and no per-table `health`. Without linked-record targets there are no
edges to draw, so Data mode would render disconnected boxes. Unblock with a
paired **server** change that adds `linkedTableId` (+ optional health) to the
schema payload, then port `SchemaCanvas.tsx` (1704 lines). The **Relationships**
mode is separately feedable via an adapter over the existing per-base
`getRelationships` (`derived` + `syncedViews`). Sequenced AFTER the Changelog
slice per the maintainer's call.

PROPOSED — not yet implemented. A new **Visualize** tab on `/schema` (after Browse):
a React Flow island (`components/schema/SchemaCanvas.tsx`) with a Data / Relationships
/ Automations & Interfaces mode menu, the ported `FieldsFilter.tsx` + `FacetFilter.astro`
controls, collapse-fields-under-table, removed-entity muting, and a below-Growth upsell
for the A&I mode. Data mode reuses `getSchema`; Relationships mode reuses
`getRelationships`; A&I mode consumes `/api/spaces/[spaceId]/entity-graph`. Launch+ gated
via the existing Schema Docs guard — no new DB/migration/capability-key. Pairs with
[`server-schema-entity-graph`](../server-schema-entity-graph/). Does NOT rewrite the
existing 5 vanilla tabs.

---

## 1. Ported field-visibility filter (test-first)

- [ ] 1.1 Write/extend the `field-visibility.ts` model tests FIRST for any behavior `FieldsFilter.tsx` relies on (tri-state per base/table/global, search-filtered bulk show/hide) — reuse the existing [`lib/schema-docs/field-visibility.ts`](../../../apps/web/src/lib/schema-docs/field-visibility.ts); do NOT duplicate the model.
- [ ] 1.2 Port `components/schema/FieldsFilter.tsx` (hierarchical Base ▸ Table ▸ Field, search, global/base/table/field show-hide, field-type icons) — presentational + `onChange(next)` callback, backed by the shared model.

## 2. FacetFilter.astro + governance registration (test-first)

- [ ] 2.1 Port `components/schema/FacetFilter.astro` (base / node-type; multi + single modes; `facetchange` / `facetreset` events) — daisyUI-only, **NO `<style>` block**.
- [ ] 2.2 Register `schema/FacetFilter.astro` in [`component-classification.json`](../../../apps/web/src/components/component-classification.json) (classification + `styleguideId` + `designHarnessPath` + rationale) and add a sibling `FacetFilter.stories.ts` — the `stories-coverage` test (apps/web/.claude/CLAUDE.md §2.5) fails CI otherwise.
- [ ] 2.3 Add the matching `/styleguide` entry in `apps/design` for the facet-filter pattern.

## 3. SchemaCanvas island + modes (test-first)

- [ ] 3.1 Confirm `SchemaCanvas.tsx` (and `FieldsFilter.tsx`) land where `islands-governance.test.ts` covers them — islands are `.tsx` only; an `.astro` in the islands dir bypasses the classification audit. Extend/point the governance test if the `schema/*` island family needs its own guard.
- [ ] 3.2 Port `components/schema/SchemaCanvas.tsx` — React Flow canvas, dagre LR layout (no force-directed), typed node components, three edge kinds + legend, collapse-fields-under-table toggle, include-removed toggle. Wire `FieldsFilter` + `FacetFilter`.
- [ ] 3.3 **Data mode** — render tables-as-nodes + linked-record edges from the SSR `fv-schema-data` (existing `getSchema` shape). No new backend.
- [ ] 3.4 **Relationships mode** — render from `getRelationships` (existing). No new backend.
- [ ] 3.5 **Automations & Interfaces mode** — fetch `/api/spaces/[spaceId]/entity-graph` (from [`server-schema-entity-graph`](../server-schema-entity-graph/)); render automation/interface/page/table/field nodes + `references`/`reads`/`triggers` edges. Empty state points to Automations/Interfaces capture; below-Growth shows the upsell.
- [ ] 3.6 Removed entities render muted + "Removed from Airtable" treatment, revealed by the include-removed toggle, across all three modes.

## 4. SchemaView wiring + audit allowlist

- [ ] 4.1 New `apps/web/src/views/schema/VisualizeTab.astro` replacing the `SoonTab.astro` Visualize entry in [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) (Explore cluster, after Browse — do NOT reorder or touch the other tabs), hosting `SchemaCanvas` (`client:visible`) with the SSR `fv-schema-data` for Data mode + lazy fetch for the other modes. Empty state when `!hasSchema`.
- [ ] 4.2 If the tab body is composed vanilla-in-view (daisyUI-direct second tier), add the `SchemaView.astro` entry to [`raw-markup-audit-allowlist.json`](../../../apps/web/src/components/raw-markup-audit-allowlist.json) noting the React Flow / mode-menu carve-out.
- [ ] 4.3 Storybook entry for the canvas pattern (typed nodes + legend + do/don't), reusing the Automations/Interfaces fixtures + a `triggers` link + a removed node.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/web test` green — incl. `islands-governance.test.ts`, `component-classification` / `stories-coverage`, `raw-markup-audit`, and the field-visibility model tests. No stray `console.*`.
- [ ] 5.2 `pnpm --filter @baseout/web typecheck` 0 errors + `pnpm --filter @baseout/web build` green.
- [ ] 5.3 `pnpm --filter @baseout/web run audit:components` green (classification + stories coverage + raw-markup allowlist).
- [ ] 5.4 Mobile responsiveness spot-check at <375px / <768px / <1024px for the canvas + filter popovers.
- [ ] 5.5 Human smoke: on a `managed_pg` Space, open `/schema` → Visualize → **Data** shows the ER graph; **Relationships** shows the relationship web; **Automations & Interfaces** shows the entity graph (after the engine ships `--remote`); FieldsFilter hides fields; FacetFilter filters by base/type; collapse-fields + include-removed work; a below-Growth org sees the A&I upsell.

## Deferred follow-ups

- [ ] Node click-through to a shared entity-detail sidebar (cross-tab reuse of Browse's entity panel).
- [ ] `page → automation` **triggers** edges populate once submitted interface payloads carry the triggered-automation reference (server-side deferred in [`server-schema-entity-graph`](../server-schema-entity-graph/)).
- [ ] Promote inline daisyUI (mode menu / legend) into Storybook components on a second call site.
- [ ] Mobile-breakpoint polish of the canvas + filters.
- [ ] **Diagram export** — PNG (Growth+), SVG (Pro+), PDF (Business+), embed widget (Enterprise) per Features §7.1 / PRD §3.1. Flagged as a spec-required follow-up, deliberately NOT in this change's scope (needs its own tier-gate + export plumbing proposal when prioritized).
