## Context

A real Airtable Space has far too many fields to show at once. The ui-only spec asks for a reusable field-visibility filter — a Base ▸ Table ▸ Field multi-select with search, bulk show/hide at each level, indeterminate states, and field-type icons — whose primary consumer is Visualize, with the selection state owned by the consuming surface. baseout's Browse tab is SSR Astro + a vanilla `<script>` and already renders the entity tree; it's the first consumer.

## Goals / Non-Goals

**Goals**
- A pure, surface-agnostic **selection model**: tri-state per group, visible/total counts, cascading show/hide, search, trigger label.
- A working **Browse Fields filter** (daisyUI dropdown) that uses the model and hides non-visible field rows.
- Reusable: Visualize/Chat import the same model later.

**Non-Goals**
- Filtering tables/bases themselves (this is *field* visibility; base/table levels are grouping + bulk controls).
- Persisting the visible-set across navigation (the consuming surface owns persistence; Browse keeps it in-memory for the session).
- A new React island (daisyUI covers a checkbox tree — governance §4.2).
- The vendored Airtable field-type icon set and list virtualization (deferred follow-ups).

## Decisions

1. **Reusable part = the model, not the markup.** `field-visibility.ts` is pure TS (no DOM/React), so both the vanilla Browse script and a future React Visualize island import it. This is the honest reading of "reusable component" in a multi-runtime app — share the selection logic, render per surface.
2. **Visible-set representation.** The visible fields are a `Set<fieldId>`. A table is `checked` when all its fields are in the set, `unchecked` when none, `indeterminate` when partial; a base derives the same over its fields; global over all. Empty groups read `unchecked`. `setFieldsVisible(set, ids, show)` returns a **new** set (no mutation) so callers stay predictable.
3. **Search keeps the subtree of any match.** A query reveals an entity if it matches, an ancestor matches, or a descendant matches (so searching a table name shows its fields; searching a field shows its table+base). Bulk controls during a search act on the matched field ids — the UI passes those ids to `setFieldsVisible`.
4. **daisyUI dropdown, inline in SchemaView.** Per governance §4.2 (Storybook first, daisyUI second), a checkbox tree is daisyUI-expressible — no new island. Promote to a `patterns/*` component once a second consumer (Visualize) exists.
5. **Indeterminate is JS-only.** `checkbox.indeterminate` is a property, not an attribute; the script sets it on render and after every toggle from `groupState`.
6. **Composes with the deleted filter.** Field-visibility hides field rows via the Tailwind `hidden` *class*; the deleted filter uses the `hidden` *attribute*. They're independent toggles — a row is shown only if neither hides it — so the two Browse filters don't fight.

## Risks / Trade-offs

- **[Risk] Huge field lists are slow/heavy in the DOM.** → Acceptable for now (one Space); virtualization + collapse-by-default deferred and noted.
- **[Risk] Indeterminate cascade confusion.** → Standard tri-state semantics driven by `groupState`, with visible/total counts at each level.
- **[Trade-off] Bulk-with-search scope.** → Bulk acts on matched fields when a search is active, labeled as such.
- **[Trade-off] No field-type icon yet.** → The existing type label preserves recognition; the vendored icon set is a follow-up, not a blocker.

## Component reuse

- The existing Browse entity tree + the field-type label already rendered there.
- daisyUI `dropdown` + `checkbox` + `menu`/`collapse` and the existing input styling.
- The `web-deleted-items-filter` hide convention (composed, not duplicated).
