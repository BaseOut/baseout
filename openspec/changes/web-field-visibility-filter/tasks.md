## Status

Pure selection model + Browse consumer. daisyUI dropdown inline in `SchemaView` (governance §4.2 — no React island). Composes with `web-deleted-items-filter`. The vendored Airtable field-type icon set and list virtualization are deferred (Browse uses the field-type label; one Space's field list is small enough un-virtualized).

---

## 1. Selection-model logic (TDD)

- [x] 1.1 Failing tests `apps/web/src/lib/schema-docs/field-visibility.test.ts` (15): `groupState` (all→`checked`, none/empty→`unchecked`, partial→`indeterminate`), `visibleCount`, `setFieldsVisible` (cascade show/hide, returns a NEW set, no mutation), `triggerLabel`, `matchesQuery` (field→ancestors; table→subtree; base→subtree; case-insensitive; no-match→empty), `fieldIdsOfTable`/`fieldIdsOfBase`.
- [x] 1.2 `apps/web/src/lib/schema-docs/field-visibility.ts` — pure helpers (no DOM/React). Green (15/15).

## 2. Browse Fields filter UI

- [x] 2.1 `SchemaView.astro` Browse — daisyUI `dropdown` with a "Fields: N of M" trigger; panel has a search input, a global "All fields" tri-state, and the Base ▸ Table ▸ Field checkbox tree (per-group `visible/total` counts; each field row shows its type label). Filter bar moved above the scrollable Card so the popover isn't clipped by `overflow-auto`.
- [x] 2.2 Module `<script>` (bundled — imports `field-visibility.ts`): delegated per-field toggles, group/base/global cascade, `indeterminate` from `groupState`, search filtering of the menu (matches + ancestors via `matchesQuery`), bulk-acts-on-matches during search, and applies visibility to `#schema-tree li[data-field-id]` via the Tailwind `hidden` **class** (independent of the deleted filter's `hidden` **attribute** — they compose). Schema serialized into an `is:inline` JSON `<script>` (with `<`→`<` escaping).
- [x] 2.3 Trigger "Fields: N of M" count updates on every selection change.

## 3. Verification

- [x] 3.1 `pnpm --filter @baseout/web test:unit schema-docs` 36/36 green (incl. 15 field-visibility) + `typecheck` 0 errors + `build` green. No stray `console.*` (§3.5).
- [ ] 3.2 Human smoke: `/schema` Browse → the Fields filter toggles field visibility in the tree, partial groups show indeterminate, search + bulk-on-matches work, the trigger count updates, and it composes with "Include deleted".
