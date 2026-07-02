## Why

The Browse tab renders every schema entity the engine returns — including ones deleted in Airtable, which the engine marks `status='removed'` (`system-per-space-db` lifecycle columns). Today only **bases** show a small "removed" badge ([`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) line 97); removed **tables/fields/views** render as ordinary active rows. That clutters the default view and gives no way to focus on *what was deleted, and when*.

The ui-only [`deleted-items-filter`](../../../) spec makes the convention explicit: hide `removed` entities by default, with an **"Include deleted"** filter to reveal them, marked and dated. baseout's [`getSchema`](../../../apps/web/src/lib/backup-engine.ts) already returns per-entity `status` (`active` / `removed` / `unknown`), so this is a **web-only, client-side** change — no engine or DB work.

## What Changes

- The **Browse** tab tree SHALL default to **active-only**, hiding `status='removed'` bases/tables/fields/views (today it shows all).
- A discoverable **"N deleted — show"** affordance plus an **"Include deleted"** toggle reveals removed entities, rendered **muted** with a **"deleted"** badge and a "no longer in Airtable" note (with the removal date *when the engine exposes it*).
- **`unknown`** entities (couldn't-confirm-this-run) stay visible by default — they are *not* treated as deleted.
- The hide/count logic is extracted to a pure helper under `apps/web/src/lib/schema-docs/` and unit-tested.

## Capabilities

### New Capabilities
- `deleted-items-filter`: Browse hides `removed` schema entities by default, with an include-deleted filter that reveals them marked (and dated when available); `unknown` stays visible.

### Modified Capabilities
<!-- Refines the Browse tab shipped by shared-schema-docs. No engine route or DB table changes. -->

## Impact

- [`apps/web/src/views/SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — Browse tree default-hide, filter bar + "Include deleted" toggle, "N deleted" count, muted/badge markup across all four entity levels.
- `apps/web/src/lib/schema-docs/deleted-filter.ts` (new, pure) + `deleted-filter.test.ts` — `removed`/`unknown`/`active` predicates + deleted count.
- **Pairs with** a follow-up `server-removed-item-filtering` (expose the removal date from `first_unseen_run`, and optionally support a server-side `include_removed` read). The UI here is forward-compatible: it shows the date when present.
- No DB, migration, capability-gate, or engine-route change.
