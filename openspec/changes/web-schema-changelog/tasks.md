## Status

PARTIALLY LANDED — §1 (client + proxy) shipped in `efdb90c`; §2–§5 (the tab UI)
are the remaining work. See the Status section in [`proposal.md`](./proposal.md)
for the landed-name and round-3-shell reconciliation.

Web half of the Schema Changelog. A read-only Changelog tab over
[`server-schema-changelog`](../server-schema-changelog/) — a day-grouped, base ▸
[concept-icon] entity feed with typed badges, before→after deltas, the breaks-data
⚠️ signal, base/kind/include-removed filters + search, and lazy-load. No
DB/migration/capability-key change — gates via the existing `schemaDocs` level
(Launch+), like the Health and Relationships tabs. Existing tabs are left untouched.

---

## 1. Web client + proxy route — LANDED (`efdb90c`)

- [x] 1.1 `backup-engine.ts` — `getSchemaChangelog(spaceId, baseId, limit?)` + `ChangelogEntryView` / `GetSchemaChangelogResult` view types (kind `modified|removed`, at, entityType/entityId/entityName, baseId/tableId, changeType/changeTypeName, before/after, breaksData). Landed names differ from the originally-proposed `getChangelog`/`ChangelogEvent`.
- [x] 1.2 `pages/api/spaces/[spaceId]/changelog.ts` (GET) — `guardSchemaDocsRequest` (auth + IDOR + Launch+) + param validation + proxy to the engine `/schema-changelog` route, `schemaDocsErrorStatus` mapping; mirrors [`relationships.ts`](../../../apps/web/src/pages/api/spaces/[spaceId]/relationships.ts).
- [x] 1.3 Proxy tests `changelog.test.ts` (5 green): guard outcomes, 503 engine-unconfigured, param validation, error mapping.

## 2. Governance decision + component — TDD

- [ ] 2.1 Decide the render path: promote the `apps/design` `SchemaChangelog.astro` under strict governance (register in `component-classification.json`, add `SchemaChangelog.stories.ts`, document in `apps/design` `/styleguide`, **remove any `<style>` block** → daisyUI classes only), OR compose the feed **vanilla-in-view** inside the new `ChangelogTab.astro` (daisyUI markup, documented in the `/styleguide`, ungoverned component not added). Record the choice in the change notes.
- [ ] 2.2 Whichever path: render a day-grouped feed of base ▸ [concept-icon] entity rows — typed badge derived client-side from `kind` + `changeType` (added / removed / renamed / type changed / config), before→after delta, ⚠️ row when `breaksData`; `esc()` on all engine strings; entity names/breadcrumbs resolved from the SSR entity index (the engine payload carries identifiers, not display names — see the server change's design note); concept icons (base/table/field-type) reused from the existing icon module.
- [ ] 2.3 `pnpm --filter @baseout/web run audit:components` green (classification + story + styleguide coverage), whichever path is chosen.

## 3. Changelog tab UI — TDD (or view integration test)

- [ ] 3.1 New `apps/web/src/views/schema/ChangelogTab.astro`, replacing the `SoonTab.astro` Changelog entry in [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) (Monitor cluster; do NOT reorder or touch the other tabs' logic). Lazy-load on first open, mirroring `RelationshipsTab.astro` / `HealthTab.astro`. Empty state when `!hasSchema`.
- [ ] 3.2 Base picker + event-kind picker + an "include removed" toggle. Lazy fetch via `/api/spaces/{spaceId}/changelog?baseId=…` on first open; refetch on base change. Kind + include-removed filtering is client-side over the last-fetched entries until the engine's `kinds`/`includeRemoved` params land (server change tasks §5) — then forward them. Client-side search filters the last-fetched entries (rendered wording + entity/base names). `setButtonLoading` on refetch controls.
- [ ] 3.3 Empty states from the engine contract: single-run ("changes appear after your second backup"), backed-up-no-changes ("no changes since your first backup"), and filters-exclude-everything ("no changes match these filters"). 403 → upgrade affordance (like Health/Relationships).

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/web test` green including the tab/view tests. No stray `console.*`.
- [ ] 4.2 `pnpm --filter @baseout/web exec tsc --noEmit` 0 errors; `pnpm --filter @baseout/web run build` green.
- [ ] 4.3 Mobile responsiveness checked at <375 / <768 / <1024px (the feed + filter bar).
- [ ] 4.4 `db:check` clean (schema-aware SSR reads no missing columns — per the "migrate before smoke" memory).

## 5. Human smoke (deployed engine, `--remote`)

- [ ] 5.1 On a `managed_pg` Space with ≥2 backup runs whose schema changed between them (rename a field, add a table, change a field type), open `/schema` → Changelog → a day-grouped feed of base ▸ entity rows with correct badges, before→after, and a ⚠️ on the type change. Toggle include-removed and base/kind filters + search narrow the feed.
- [ ] 5.2 A Space with one run shows the "second backup" empty state; a non-entitled org sees the upgrade message. (Engine `--remote`; existing Spaces may need re-provision.)

## Deferred follow-ups

- [ ] Click-through from a changelog entry to the shared entity-detail modal (`open-entity-detail` CustomEvent — the shell's modal already serves Browse + Relationships).
- [ ] CSV / JSON export of the feed (the design component reserves the Export dropdown).
- [ ] Full faceted filter bar (table + field-type facets beyond base/kind/search + include-removed).
- [ ] AI `aiSummary` in the entry detail panel (with the engine follow-up).
