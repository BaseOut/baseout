## Status

BUILT — AWAITING HUMAN SMOKE. §1 (client + proxy) shipped in `efdb90c`; §2–§4
(the tab UI: `views/schema/ChangelogTab.astro` + `lib/schema-docs/changelog-view.ts`
+ governance) built 2026-07-08, all checks green. Remaining: §4.3 visual breakpoint
check + §5 human smoke on a deployed dev engine. See the Status section in
[`proposal.md`](./proposal.md) for the landed-name and round-3-shell reconciliation.

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

- [x] 2.1 **DECISION: vanilla-in-view.** The feed is composed inside `views/schema/ChangelogTab.astro` with daisyUI markup (the design's `cl-*`-styled `SchemaChangelog.astro` stays in `apps/design`), matching how RelationshipsTab/HealthTab shipped. Documented as the `pattern-changelog-feed` entry in the `apps/design` `/styleguide` (`apps/design/src/lib/storybook.ts`); `ChangelogTab.astro` registered in `raw-markup-audit-allowlist.json`.
- [x] 2.2 Day-grouped feed of base ▸ [concept-icon] entity rows — typed badge derived client-side from `kind` + `changeType` (added / removed / renamed / type changed / config), before→after delta, ⚠️ row when `breaksData`; `esc()` on all engine strings; entity names/breadcrumbs resolved from the SSR schema index embedded by the tab (`cl-schema-data`). Derivation/grouping/filtering logic is the pure module `lib/schema-docs/changelog-view.ts`, TDD'd in `changelog-view.test.ts` (13 green).
- [x] 2.3 `pnpm --filter @baseout/web run audit:components` green (classification + story + styleguide coverage + raw-markup allowlist).

## 3. Changelog tab UI — TDD (or view integration test)

- [x] 3.1 New `apps/web/src/views/schema/ChangelogTab.astro`, replacing the `SoonTab.astro` Changelog entry in [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) (Monitor cluster; other tabs untouched). Lazy-load on first `[data-tab="changelog"]` click, mirroring `RelationshipsTab.astro`. Empty state when `!hasSchema`.
- [x] 3.2 Base picker (refetches — `baseId` is required by the engine route) + kind picker + an "include removed" toggle (default ON — removals are half the feed's value) + `data-sch-search` search. Kind / include-removed / search filter client-side over the last-fetched entries until the engine's `kinds`/`includeRemoved` params land (server change tasks §5). Loading spinner in the content area during fetch (select-driven refetch — no button to spin).
- [x] 3.3 Empty states: no-entries ("changes appear once a backup captures a difference — from your second backup on"; the engine returns `entries: []` for both single-run and no-changes, so one honest combined message), filters-exclude-everything ("No changes match these filters" + Clear-filters affordance), 403 → upgrade message (like Health/Relationships), fetch/error state.

## 4. Verification

- [x] 4.1 `pnpm --filter @baseout/web exec vitest run` — full suite green (92 files / 1032 tests, incl. the 13 new `changelog-view` tests). No stray `console.*` in the diff.
- [x] 4.2 `pnpm --filter @baseout/web typecheck` (astro check) 0 errors; `pnpm --filter @baseout/web run build` green; `apps/design` build green (styleguide entry).
- [ ] 4.3 Mobile responsiveness checked at <375 / <768 / <1024px (the feed + filter bar — same flex-wrap layout as the verified sibling tabs; visual check folds into the §5 smoke).
- [x] 4.4 `db:check` clean (no pending migrations — this change reads no new columns).

## 5. Human smoke (deployed engine, `--remote`)

- [ ] 5.1 On a `managed_pg` Space with ≥2 backup runs whose schema changed between them (rename a field, add a table, change a field type), open `/schema` → Changelog → a day-grouped feed of base ▸ entity rows with correct badges, before→after, and a ⚠️ on the type change. Toggle include-removed and base/kind filters + search narrow the feed.
- [ ] 5.2 A Space with one run shows the "second backup" empty state; a non-entitled org sees the upgrade message. (Engine `--remote`; existing Spaces may need re-provision.)

## Deferred follow-ups

- [ ] Click-through from a changelog entry to the shared entity-detail modal (`open-entity-detail` CustomEvent — the shell's modal already serves Browse + Relationships).
- [ ] CSV / JSON export of the feed (the design component reserves the Export dropdown).
- [ ] Full faceted filter bar (table + field-type facets beyond base/kind/search + include-removed).
- [ ] AI `aiSummary` in the entry detail panel (with the engine follow-up).
