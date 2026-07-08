# Promote the round-3 Schema shell into apps/web

## Why
Dan's round-2/3 Schema design (ui-only@d97c777, staged in apps/design) reorganizes the
Schema page into 8 tabs across 4 labelled clusters with a persistent chat launcher and
a canonical detail-panel anatomy. Production `/schema` already ships 5 wired tabs
(Browse · Relationships · Health · Docs · Chat) vanilla-in-view inside a 1,415-line
`SchemaView.astro`. Per the promotion decision (2026-07-07): adopt the full shell now,
"soon"-gate the tabs whose backends are still proposed (`web-schema-visualize`,
`web-schema-changelog`, `web-automations-interfaces-tabs` + insights), and keep the
5 live tabs on their real data.

## What changes
- **Split the monolith into the views tier.** `SchemaView.astro` becomes the shell
  (header + freshness stamp + clustered tab bar + panel switching + shared entity
  modal); each tab body moves verbatim — markup, ids, and script together — to
  `src/views/schema/{BrowseTab,RelationshipsTab,HealthTab,DocsTab,ChatTab}.astro`.
- **Clustered tab bar** ported from the design SchemaView (`.sch-tabbar`, approved
  /schema-nav Variant A): Explore (Browse · Visualize · Relationships) · App layer
  (Automations · Interfaces) · Monitor (Changelog · Health) · Knowledge (Docs · Chat
  History). Tabs are icon-carrying buttons (`data-tab`) toggling `data-panel` sections;
  the three lazy-load hooks (Health/Relationships/Chat) rewire from radio-change to
  tab-button click — same one-shot semantics.
- **"Ask about your schema" launcher** (catalog Ghost Button, header right) selects the
  Chat panel. The design's presentational quick-ask dock is NOT promoted — it fakes a
  conversation; the real slim-drawer version rides the chat follow-up.
- **Soon-gated tabs**: `{VisualizeTab,ChangelogTab,AutomationsTab,InterfacesTab}.astro`
  render a `.sch-soon` state naming the capability and that it's coming, matching the
  design's empty-state icon language. Lit up by their own slices later.
- **Browse detail panel → canonical EntityPanel anatomy** (views-tier partial +
  client render): identity line, removed-notice (`alert alert-soft alert-warning`,
  fed by the enriched `removedAt`), description sections (Airtable / AI / internal),
  field configuration (Formula / Looks up / Rolls up / Choices / Links to), and
  back-references ("← referenced by") + grouped "Referenced by"
  (Formulas · Rollups · Lookups · Docs) — the reverse graph inverted from the
  `server-schema-read-enrichment` payload by a pure, tested module
  (`lib/schema-docs/entity-index.ts`). Automations/Interfaces/Chats groups join in
  their slices.
- **Toolbar canon**: "Include removed" wording everywhere (never "deleted");
  `data-sch-search` on the tab search inputs so the shell's `/` shortcut focuses the
  active tab's search.
- **Canon display maps (audit D)**: health band `yellow`→"amber", severity
  `medium`→"med" at render time; DB spelling unchanged.
- **CSS**: the schema-shared sections staged in `apps/design/src/styles/schema-lab.css`
  (ghost hover, tooltips, `.sch-tb` toolbar, concept icons, sortable headers,
  scroll-lock) move into `apps/web/src/styles/global.css`, plus the design shell's
  `.sch-*` layout CSS (tabbar/head/stamp/panel/empty/soon). `schema-lab.css` and its
  design-layout import are deleted — apps/design inherits through `@web` global.css.
- **Governance**: each new `views/schema/*.astro` registered in
  `raw-markup-audit-allowlist.json` with reasons; the three round-3 styleguide entries
  retarget to the promoted prod paths.

## Non-goals
- No behavior change to the 5 live tabs' data flows (13 proxy routes untouched).
- No quick-ask dock, no Visualize/Changelog/A&I/Insights functionality (own slices).
- No Health/Docs/Chat body redesign (rides insights/chat slices).

## Impact
- `apps/web/src/views/SchemaView.astro` (shell) + new `src/views/schema/*` (9 files).
- `apps/web/src/lib/schema-docs/entity-index.ts` (new, pure, tested).
- `apps/web/src/styles/global.css` (+~240 lines, all `.sch-*`/tooltip/concept-icon
  prefixed), `apps/design/src/styles/schema-lab.css` deleted.
- `raw-markup-audit-allowlist.json`, `apps/design/src/lib/storybook.ts` (references).
- Depends on `server-schema-read-enrichment`; unblocks slices 2–5 visually.
