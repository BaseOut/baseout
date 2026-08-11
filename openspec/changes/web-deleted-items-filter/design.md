## Context

Deleted schema entities are retained as `status='removed'` by the engine (`system-per-space-db` lifecycle columns: `status` ∈ `active|removed|unknown`, plus `first_seen_run`/`first_unseen_run`/`last_seen_run`). [`getSchema`](../../../apps/web/src/lib/backup-engine.ts) already surfaces `status` on every `SchemaEntity*` type, and the Browse detail panel already flags a removed entity via the `entityRemoved` field on `docs-by-entity`. What's missing is the **default-hide + reveal filter** in the Browse tree, and consistent muted/badge styling across tables/fields/views (not just bases).

Browse is server-rendered Astro with a vanilla `<script>` (no React island). All entities are already in the SSR DOM, so the filter is a **client-side show/hide**, not a refetch.

## Goals / Non-Goals

**Goals**
- Hide `status='removed'` entities by default in the Browse tree (all four levels: base/table/field/view).
- A clear "Include deleted" toggle that reveals them, muted + "deleted" badge + "no longer in Airtable" note.
- A discoverable "N deleted — show" count so hidden items aren't invisible.
- `unknown` stays visible (not treated as deleted).

**Non-Goals**
- Record-level deletion UI (scope is schema entities only).
- Restoring deleted entities (read/visibility only).
- The flat-list Browse mode and the Relationships "include removed" toggle (those arrive with their own changes; this keeps the badge/muted styling consistent for them to reuse).
- Server-side `include_removed` filtering and the precise removal **date** — both need the engine; named as the paired `server-removed-item-filtering` follow-up.

## Decisions

1. **Client-side show/hide, SSR-rendered.** Removed entities are rendered into the tree with a `data-removed` marker and `hidden` by default; the toggle flips visibility. No second fetch — `getSchema` already returns `status`, and the data is small (one Space's schema).
2. **Pure logic extracted + tested.** A `deleted-filter.ts` helper owns the `removed`/`unknown`/`active` classification and the total deleted count, so the rule "`unknown` is not deleted" is unit-tested independently of the `.astro` markup (per CLAUDE §3.4).
3. **Muted + badge across all levels.** Bases already badge "removed"; extend the same `Badge variant="warning"` + de-emphasized styling to removed tables/fields/views, so "deleted" reads identically everywhere (and matches what Relationships will reuse).
4. **Date when available.** Render the removal note as "no longer in Airtable" now; show "since &lt;date&gt;" only when the entity carries a removal date. Adding that date is the engine follow-up — the UI degrades gracefully without it.
5. **Count affordance is the toggle's label.** The "Include deleted" control shows the count ("N deleted") and is omitted entirely when nothing is removed, so it never adds noise to a clean schema.

## Risks / Trade-offs

- **[Risk] Silently hiding deleted items.** → The "N deleted — show" count keeps the filter discoverable; it's only hidden when the count is zero.
- **[Trade-off] Muted-but-present removed rows in the DOM.** → They're `hidden` by default (not stripped), keeping them one toggle away and navigable to detail — acceptable given a single Space's schema size.
- **[Trade-off] No removal date yet.** → Honest "no longer in Airtable" copy now; date lights up automatically when the engine exposes it. Avoids blocking a UI-only win on backend work.

## Component reuse

- The existing Browse tree + the `Badge` (`variant="warning"`) used for the current bases "removed" badge.
- `setButtonLoading` is not needed (no server round-trip); the toggle is a pure client interaction.
- The muted/"deleted" styling is authored so the future Relationships "include removed" toggle and flat-list mode reuse it.
