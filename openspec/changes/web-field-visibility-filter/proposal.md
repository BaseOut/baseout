## Why

Schema surfaces need a way to filter *which fields* are visible — primarily **Visualize** (a busy diagram must show only relevant fields), but also Browse (focus a large schema) and later Chat scoped-context. There's no field-level visibility control today. The ui-only [`field-visibility-filter`](../../../) spec defines a reusable hierarchical **Base ▸ Table ▸ Field** multi-select with search, bulk show/hide at every level, indeterminate states, and a "Fields: N of M" trigger.

In baseout the genuinely reusable part is the **selection model** — deriving tri-state from a visible-set, counts, cascades, and search — which is surface-agnostic and unit-testable. The markup differs per surface. **Browse** is the first real consumer (it already renders the Base ▸ Table ▸ Field tree); Visualize/Chat reuse the same logic when they land.

## What Changes

- A pure, reusable selection-model module: tri-state (`checked`/`unchecked`/`indeterminate`) for table/base/global from a visible-field `Set`, visible/total counts, cascading show/hide, search (matches + ancestors/descendants), and the trigger label.
- A **Fields** filter on the **Browse** tab: a daisyUI dropdown showing "Fields: N of M", opening a searchable Base ▸ Table ▸ Field checkbox tree with global/base/table bulk show-hide and per-field toggles; hides non-visible field rows in the Browse tree.
- Composes with the `web-deleted-items-filter` "Include deleted" toggle (independent hide mechanisms).

## Capabilities

### New Capabilities
- `field-visibility-filter`: a reusable hierarchical field-visibility selection model (Base ▸ Table ▸ Field — searchable, with global/base/table/field show-hide and indeterminate states) plus its first consumer, the Browse Fields filter.

### Modified Capabilities
<!-- New reusable filter; first consumed by the Browse tab. Visualize/Chat reuse the model later. -->

## Impact

- `apps/web/src/lib/schema-docs/field-visibility.ts` (new, pure) + `field-visibility.test.ts` — the selection model.
- [`apps/web/src/views/SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — Browse Fields dropdown (daisyUI, inline per governance §4.2) + the vanilla script that drives state and applies visibility to the tree.
- **Deferred (noted, not blocking):** the vendored Airtable field-type icon set (`overview/schema/field-icons/`) — Browse uses the existing field-type label for now; and list virtualization for very large schemas.
- No backend/DB change.
