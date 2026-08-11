## Status

BUILT (Data + Relationships modes) — AWAITING HUMAN SMOKE, 2026-07-09. §1, §3 (minus
the A&I live fetch), §4, and §5.1–5.3 landed; §2 re-scoped to the A&I tabs slice.
Remaining: §5.4–5.5 smoke, and the A&I mode's live graph (§3.5) which lands with
`server-schema-entity-graph`.

Original context — PROPOSED; engine dependency CLEARED 2026-07-07 by `server-schema-read-enrichment`:
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

- [x] 1.1 `FieldsFilter.tsx` is backed by the existing [`lib/schema-docs/field-visibility.ts`](../../../apps/web/src/lib/schema-docs/field-visibility.ts) model — `groupState` / `visibleCount` / `setFieldsVisible` (already unit-tested; no new model behavior was needed). The component's hidden-set contract inverts at the boundary (`setFieldsVisible(hidden, ids, hide)` — documented in the component header). No duplicate tri-state math.
- [x] 1.2 Ported to `components/islands/FieldsFilter.tsx` (hierarchical Base ▸ Table ▸ Field, search keeping ancestors, bulk show/hide over matches, collapse/expand, field-type icons). New shared lib `lib/schema-docs/airtable-field-icons.ts` (vendored icon set + camelCase-aware `airtableIconKey`/`fieldTypeLabel`, TDD'd — `airtable-field-icons.test.ts`, 3 green).

## 2. FacetFilter.astro + governance registration — MOVED to the A&I tabs slice

- [x] 2.1–2.3 **Re-scoped 2026-07-09:** `FacetFilter.astro` is NOT consumed by the canvas — SchemaCanvas carries its own inline React `FacetDropdown` (ported as-is). The Astro FacetFilter serves the Automations/Interfaces/Changelog toolbars, so its port + governance registration moves to [`web-automations-interfaces-tabs`](../web-automations-interfaces-tabs/tasks.md). Nothing owed here.

## 3. SchemaCanvas island + modes (test-first)

- [x] 3.1 `SchemaCanvas.tsx` + `FieldsFilter.tsx` live under `components/islands/` (`.tsx` — `islands-governance.test.ts` green).
- [x] 3.2 Ported `components/islands/SchemaCanvas.tsx` — React Flow canvas, dagre LR layout, typed node components, edge kinds + mode-aware legend, focus-mode dimming, search-jump, inline FacetDropdowns + FieldsFilter. New dependency `@dagrejs/dagre@^3.0.0` added to apps/web. Port adaptations: `health` optional (no per-table grade in the engine payload yet — dot/legend render only when present), camelCase field types resolved in `relKind`/`typeLabel`/icons, node click dispatches the shared `open-entity-detail` modal event, and the design's non-functional Add-to-doc + Export dropdowns were NOT ported (deferred, see below).
- [x] 3.3 **Data mode** — renders from the SSR schema props via the `VisualizeTab.astro` adapter (enriched `SchemaEntityField` config → linked/lookup/rollup/formula edges). No new backend.
- [x] 3.4 **Relationships mode** — lazy-fetches the live `/api/spaces/:id/relationships` feed per live base on first mode switch, adapted client-side (`adaptEngineRelationships`: derived refs → endpoints, syncedViews → typed edges), with loading / error / no-relationships states.
- [ ] 3.5 **Automations & Interfaces mode** — the mode + empty state + below-Growth upsell shipped; the live `/api/spaces/[spaceId]/entity-graph` fetch lands with [`server-schema-entity-graph`](../server-schema-entity-graph/) (plan Slice 4).
- [x] 3.6 Removed FIELDS pass through flagged (canvas drops them from live node rows); removed tables/bases are excluded by the adapter (live diagram; app-layer removed-muting ships with the A&I data).

## 4. SchemaView wiring + audit allowlist

- [x] 4.1 New `apps/web/src/views/schema/VisualizeTab.astro` replaced the SoonTab Visualize entry in `SchemaView.astro` (Explore cluster; other tabs untouched), hosting `SchemaCanvas` (`client:visible`) with the adapted SSR schema + `spaceId` for the Relationships-mode fetch. Empty state when `!hasSchema`.
- [x] 4.2 No allowlist entry needed — the tab is a thin island host (no daisyUI-audit-triggering markup); the exact-match `component-classification` test enforces this.
- [x] 4.3 `/styleguide` entry `pattern-schema-canvas` added in `apps/design/src/lib/storybook.ts` (mode switch + faceted toolbar + typed nodes/edges + legend, do/don't).

## 5. Verification

- [x] 5.1 `pnpm --filter @baseout/web exec vitest run` green — 93 files / 1035 tests, incl. `islands-governance`, `component-classification`, `stories-coverage`, and the new icon-lib tests. No stray `console.*`.
- [x] 5.2 `astro check` 0 errors + `pnpm --filter @baseout/web run build` green (+ `apps/design` build green for the styleguide entry).
- [x] 5.3 `pnpm --filter @baseout/web run audit:components` green.
- [ ] 5.4 Mobile responsiveness spot-check at <375px / <768px / <1024px for the canvas + filter popovers (folds into the §5.5 smoke).
- [ ] 5.5 Human smoke: on the provisioned `managed_pg` Space, open `/schema` → Visualize → **Data** shows the ER graph; **Relationships** shows the live relationship web (or its empty state); **Automations & Interfaces** shows the empty/upsell card (graph lights up after `server-schema-entity-graph`); FieldsFilter hides fields; facet dropdowns filter by base/table/type; a below-Growth org sees the A&I upsell.

## Deferred follow-ups

- [ ] Node click-through to a shared entity-detail sidebar (cross-tab reuse of Browse's entity panel).
- [ ] `page → automation` **triggers** edges populate once submitted interface payloads carry the triggered-automation reference (server-side deferred in [`server-schema-entity-graph`](../server-schema-entity-graph/)).
- [ ] Promote inline daisyUI (mode menu / legend) into Storybook components on a second call site.
- [ ] Mobile-breakpoint polish of the canvas + filters.
- [ ] **Diagram export** — PNG (Growth+), SVG (Pro+), PDF (Business+), embed widget (Enterprise) per Features §7.1 / PRD §3.1. Flagged as a spec-required follow-up, deliberately NOT in this change's scope (needs its own tier-gate + export plumbing proposal when prioritized). The design's non-functional Export dropdown was intentionally not ported.
- [ ] **Add-to-doc** — attach the current diagram to a Document (the design prototype only toasted; real persistence needs the docs-diagram API). Not ported.
- [ ] **Per-table health on nodes** — the engine schema payload carries no per-table grade; wire `getHealthOverview` into the adapter when Health/Visualize integration is prioritized (the canvas already renders the dot + legend when `health` is present).
- [ ] Relationships-mode edge click → the shared relationship detail panel (the canvas keeps selection/tooltip; the `schema:openRelationship` handoff has no listener in apps/web yet).
