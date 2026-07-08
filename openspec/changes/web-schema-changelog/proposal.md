# web-schema-changelog — Changelog tab on the Schema page

## Status

PARTIALLY LANDED — the data path shipped in `efdb90c` (2026-07-08); the tab UI
is the remaining work (and the smallest remaining schema-page slice, since its
feed is already live end-to-end). Reconciliation notes:

- **Landed:** engine client method `getSchemaChangelog(spaceId, baseId, limit?)`
  + `ChangelogEntryView` / `GetSchemaChangelogResult` types in
  `apps/web/src/lib/backup-engine.ts`, and the guarded proxy
  `GET /api/spaces/[spaceId]/changelog` (`guardSchemaDocsRequest` — auth + IDOR
  + Launch+) with tests (5 green). Names differ from the original text below
  (`getChangelog` / `ChangelogEvent`); the landed names are authoritative.
- **Leaner engine payload than originally designed** (see
  [`server-schema-changelog`](../server-schema-changelog/proposal.md) Status):
  entries carry `kind: 'modified' | 'removed'` + raw `changeType`/
  `changeTypeName`/`before`/`after`/`breaksData`, no engine-rendered `summary`.
  The tab derives the display taxonomy (renamed / retyped / config badges) from
  `changeType` and resolves entity names/breadcrumbs from the SSR entity index
  the Schema page already embeds. `added` events, automation/interface events,
  and `since`/`kinds`/`includeRemoved` params are the engine change's remaining
  scope — the tab's kind filter can ship client-side first.
- **Round-3 shell landed** (`web-schema-round3-shell`, `09949d3`): tabs are now
  per-file components under `apps/web/src/views/schema/` and Changelog renders
  the `SoonTab.astro` placeholder. The tab UI work is a new
  `views/schema/ChangelogTab.astro` (lazy-loaded like `RelationshipsTab.astro` /
  `HealthTab.astro`), replacing the SoonTab entry in `SchemaView.astro` — not
  a radio tab added to a monolithic SchemaView as written below.

## Why

The engine now assembles a per-Space schema changelog feed
([`server-schema-changelog`](../server-schema-changelog/)) — a read-time union of
lifecycle added/removed events, `bo_at_schema_updates` renamed/retyped/config
events (with before→after + a breaks-data warning), and automation/interface
status/config events, each dated by its run and located as base ▸ entity — but
nothing surfaces it. The ui-only Changelog design (`overview/schema/02-changelog-tab.md`)
and the built `SchemaChangelog.astro` component describe a **Changelog** tab on the
Schema page: a day-grouped, base ▸ [concept-icon] entity feed of "what changed in
my Airtable structure" (e.g. "Automation turned off · Active → Inactive"), with the
⚠️ breaks-data signal, filters, and lazy-load. This change adds that tab, wired to
the real engine feed.

Pairs with [`server-schema-changelog`](../server-schema-changelog/) (the engine feed).

## What Changes

- A new **Changelog** tab on `/schema` (in the structural-view cluster, next to
  Relationships / Visualize — per the ui-only tab order `Browse · Visualize ·
  Relationships · Changelog · Health · Docs`). Per **base** (or all bases): a
  **day-grouped** feed of change events rendered as **base ▸ [concept-icon] entity**
  rows — each with a typed badge (added / removed / renamed / type changed / config /
  view), the engine's rendered summary, an optional before → after delta, and a ⚠️
  affordance when the change may have broken data.
- **Filters:** base, event kind, and an **include-removed** toggle (forwards
  `includeRemoved` + `kinds` + `baseId` to the proxy). A `since` (time-range) filter
  reuses the same param. Client-side search over the last-fetched events.
- The tab **lazy-loads** on first open and refetches on base/filter change.
- **Empty states** match the engine contract: "changes appear after your second
  backup" (single run, nothing to diff) and "no changes since your first backup"
  (backed up, no changes).
- **Launch+ gating** reuses the Schema Docs tier guard (no new capability key), like
  the Health and Relationships tabs.
- New web client method `getChangelog` + proxy route `/api/spaces/[spaceId]/changelog`
  (GET), mirroring `getRelationships` / `relationships.ts`.
- **GOVERNANCE (§4.2 / two-tier UI):** the round-2 `components/schema/SchemaChangelog.astro`
  is promoted under strict governance — registered in `component-classification.json`,
  given a `*.stories.ts`, and documented in the `apps/design` `/styleguide`, with **no
  `<style>` block** (daisyUI classes only). If a compliant Storybook component is not
  viable in this change, the feed is instead composed **vanilla-in-view** in
  `SchemaView.astro` (daisyUI markup directly, documented in the `/styleguide`) and the
  ungoverned component is NOT dumped into `apps/web`. Either path satisfies `audit:components`.
- Per §3.2 "don't refactor what works," the existing Browse/Docs/Health/Relationships
  tabs are left untouched — this change only adds the Changelog tab + its proxy.

## Capabilities

### New Capabilities

- `changelog-tab`: the read-only Changelog view — a day-grouped, base ▸ [concept-icon]
  entity feed of schema change events with typed badges, before→after deltas, the
  breaks-data ⚠️ signal, base/kind/include-removed filters + client search, lazy-load,
  and Launch+ gating; wired to the engine changelog feed via a guarded proxy.

### Modified Capabilities

<!-- Adds a tab to the Schema page; consumes server-schema-changelog. No new DB/migration/capability-key. -->

## Impact

- `apps/web/src/lib/backup-engine.ts` — `getChangelog(spaceId, opts?)` (`baseId` /
  `since` / `kinds` / `includeRemoved`) + `ChangelogEvent` view types + `GetChangelogResult`,
  mirroring [`getRelationships`](../../../apps/web/src/lib/backup-engine.ts).
- `apps/web/src/pages/api/spaces/[spaceId]/changelog.ts` (GET) — guarded proxy reusing
  `guardSchemaDocsRequest` (auth + IDOR + tier), param validation, 503 when the engine is
  unconfigured, `schemaDocsErrorStatus` mapping. Mirrors
  [`relationships.ts`](../../../apps/web/src/pages/api/spaces/[spaceId]/relationships.ts).
- [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — the Changelog tab
  (radio tab + tab-content + base/kind picker + include-removed toggle + lazy fetch + feed
  render + entry detail).
- `apps/web/src/components/schema/SchemaChangelog.astro` — promoted-under-governance OR its
  markup composed vanilla-in-view (see the governance decision above); registered in
  `component-classification.json` + `*.stories.ts` + `/styleguide` if promoted.
- **Pairs with** [`server-schema-changelog`](../server-schema-changelog/).
- **Reuses:** the existing `guardSchemaDocsRequest` proxy guard, the Airtable field-type
  icons + app-layer concept icons, the status-badge palette, and the Schema-page radio-tab
  pattern.
- **Deferred follow-ups:**
  - Click-through from a changelog entry to the shared Browse entity-detail sidebar
    (cross-tab reuse of Browse's entity panel) — the component already models
    `entityId`/`data-open-entity`; wiring is deferred.
  - CSV / JSON export of the feed (the component reserves the Export dropdown).
  - Full faceted filter bar (table + field-type facets beyond base/kind/search) — the
    ui-only component models `FacetFilter`; the shipped tab starts with base/kind/search +
    include-removed.
  - AI `aiSummary` in the entry detail panel (deferred with the engine follow-up).
  - No DB/migration/capability-key change.
