# Tasks — round-3 Schema shell promotion

## 1. Pure logic (TDD)
- [x] 1.1 RED+GREEN: `lib/schema-docs/entity-index.ts` — invert the enriched schema's
      forward graph into per-field back-references + grouped "Referenced by"
      (formulas / rollups / lookups / links), and shape the per-entity panel payload
      (config labels, descriptions, removedAt); `entity-index.test.ts` beside it

## 2. Shell + split
- [x] 2.1 Move the five tab bodies (markup + script, ids verbatim) to
      `views/schema/{BrowseTab,RelationshipsTab,HealthTab,DocsTab,ChatTab}.astro`
- [x] 2.2 Shell `SchemaView.astro`: header + freshness stamp + clustered `.sch-tabbar`
      (buttons, icons, 4 cluster labels) + `data-panel` switching + `/` search shortcut
      + "Ask about your schema" ghost launcher → Chat panel
- [x] 2.3 Rewire the Health / Relationships / Chat lazy-load hooks from radio-change to
      their `data-tab` button click (one-shot load preserved)
- [x] 2.4 Soon tabs: one parameterized `views/schema/SoonTab.astro` (icon/title/copy)
      mounted in the shell's Visualize/Changelog/Automations/Interfaces panels

## 3. Browse round-3
- [x] 3.1 Detail panel renders the canonical anatomy from the serialized entity index:
      identity, removed notice (alert-soft alert-warning + removedAt), description
      sections, field configuration, back-refs + grouped Referenced-by, Documentation
      (existing docs-by-entity fetch)
- [x] 3.2 Toolbar canon: "Include removed" wording; `data-sch-search` on searches
- [x] 3.3 Canon display maps: band yellow→amber, severity medium→med (render-time only)

## 4. CSS + governance
- [x] 4.1 Move schema-lab.css sections + design shell `.sch-*` CSS into
      `apps/web/src/styles/global.css`; delete `schema-lab.css` + its design import
- [x] 4.2 `raw-markup-audit-allowlist.json` entries for each `views/schema/*.astro`
- [x] 4.3 Retarget the three round-3 styleguide entries to promoted prod paths;
      `audit:components` green

## 5. Verification
- [x] 5.1 Web unit suites + typecheck + build green; design build green
- [ ] 5.2 Human smoke on the managed_pg Space (deployed engine): clustered nav, 5 live
      tabs on real data, 4 soon tabs, Browse panel anatomy + back-refs
