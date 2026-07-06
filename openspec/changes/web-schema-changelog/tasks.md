## Status

PROPOSED — not yet implemented.

Web half of the Schema Changelog. A read-only Changelog tab over
[`server-schema-changelog`](../server-schema-changelog/) — a day-grouped, base ▸
[concept-icon] entity feed with typed badges, before→after deltas, the breaks-data
⚠️ signal, base/kind/include-removed filters + search, and lazy-load. No
DB/migration/capability-key change — gates via the existing `schemaDocs` level
(Launch+), like the Health and Relationships tabs. Existing tabs are left untouched.

---

## 1. Web client + proxy route — TDD

- [ ] 1.1 RED: `backup-engine` view-type + method test — `getChangelog(spaceId, { baseId?, since?, kinds?, includeRemoved? })` returns `{ events }`; assert query-param construction + `ChangelogEvent` typing, mirroring `getRelationships`.
- [ ] 1.2 GREEN: `backup-engine.ts` — `getChangelog` + `ChangelogEvent` / `GetChangelogResult` view types (kind, at, base/table/entity location, before/after, warning, entityKind).
- [ ] 1.3 RED: `changelog.test.ts` (proxy) — `guardSchemaDocsRequest` outcomes (401 unauth, 403 non-IDOR/non-entitled, 200 ok), 503 when the engine is unconfigured, param validation (`baseId`/`since`/`kinds`/`includeRemoved`), `schemaDocsErrorStatus` mapping.
- [ ] 1.4 GREEN: `pages/api/spaces/[spaceId]/changelog.ts` (GET) — guard + validate + proxy to the engine `getChangelog`; mirror [`relationships.ts`](../../../apps/web/src/pages/api/spaces/[spaceId]/relationships.ts).

## 2. Governance decision + component — TDD

- [ ] 2.1 Decide the render path: promote `components/schema/SchemaChangelog.astro` under strict governance (register in `component-classification.json`, add `SchemaChangelog.stories.ts`, document in `apps/design` `/styleguide`, **remove any `<style>` block** → daisyUI classes only), OR compose the feed **vanilla-in-view** in `SchemaView.astro` (daisyUI markup, documented in the `/styleguide`, ungoverned component not added). Record the choice in the change notes.
- [ ] 2.2 If promoting: the component renders a day-grouped feed of base ▸ [concept-icon] entity rows — typed badge (added/removed/renamed/typed/config/view), engine `summary`, before→after delta, ⚠️ warning row; `esc()` on all engine strings; concept icons (base/table/field-type + automation/interface) reused from the existing icon module.
- [ ] 2.3 `pnpm --filter @baseout/web run audit:components` green (classification + story + styleguide coverage), whichever path is chosen.

## 3. Changelog tab UI — TDD (or view integration test)

- [ ] 3.1 `SchemaView.astro` — add a "Changelog" radio tab (in the structural-view cluster; do NOT reorder or touch the other tabs' logic). Empty state when `!hasSchema`.
- [ ] 3.2 Base + event-kind pickers + an "include removed" toggle. Lazy fetch on first open; refetch on base/kind/toggle change. Render the day-grouped feed via the component (or vanilla markup). Client-side search filters the last-fetched events (summary + entity/base names).
- [ ] 3.3 Empty states from the engine contract: single-run ("changes appear after your second backup"), backed-up-no-changes ("no changes since your first backup"), and filters-exclude-everything ("no changes match these filters"). 403 → upgrade affordance (like Health/Relationships).

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/web test` green including the new proxy + client tests. No stray `console.*`.
- [ ] 4.2 `pnpm --filter @baseout/web exec tsc --noEmit` 0 errors; `pnpm --filter @baseout/web run build` green.
- [ ] 4.3 Mobile responsiveness checked at <375 / <768 / <1024px (the feed + filter bar). `setButtonLoading` on any server-waiting control (filter refetch).
- [ ] 4.4 `db:check` clean (schema-aware SSR reads no missing columns — per the "migrate before smoke" memory).

## 5. Human smoke (deployed engine, `--remote`)

- [ ] 5.1 On a `managed_pg` Space with ≥2 backup runs whose schema changed between them (rename a field, add a table, change a field type, toggle an automation), open `/schema` → Changelog → a day-grouped feed of base ▸ entity rows with correct badges, before→after, and a ⚠️ on the type change. Toggle include-removed reveals removed entities; base/kind filters + search narrow the feed.
- [ ] 5.2 A Space with one run shows the "second backup" empty state; a non-entitled org sees the upgrade message. (Engine `--remote`; existing Spaces may need re-provision.)

## Deferred follow-ups

- [ ] Click-through from a changelog entry to the shared Browse entity-detail sidebar (the component already models `entityId` / `data-open-entity`).
- [ ] CSV / JSON export of the feed (the component reserves the Export dropdown).
- [ ] Full faceted filter bar (table + field-type facets beyond base/kind/search + include-removed).
- [ ] AI `aiSummary` in the entry detail panel (with the engine follow-up).
