## Why

Customers can't see how their schema interconnects. Airtable exposes *some* relationships — linked records, formulas, rollups, lookups, and `lastModifiedBy`/`lastModifiedTime` references — via the schema API, but **synced-view relationships between tables (often across bases) are not exposed**, even though they're a key cross-base link. We want a Relationships surface backed by a relationship graph that captures both API-derived and **inferred** (synced-view) relationships, preserves history (when first seen / when removed), and lets users confirm or dismiss inferred ones.

## What Changes

- Introduce a per-Space **relationship graph**: a typed `relationships` record + a many-to-many **link table** that pairs entities, each link carrying its own status and first-seen / removed history.
- Relationship **types**: `linked_records`, `formula`, `rollup`, `lookup`, `last_modified` (API-derived from schema sync) and `synced_view` (**inferred**).
- **Inferred synced views**: when two tables (often in different bases) have very similar field structures, pre-populate a `synced_view` relationship with `status = inferred`; the user can **confirm** it or **dismiss/remove** it.
- **Link history**: each entity pair has a `status` (`active` | `removed`) with first-seen / removed markers — a linked record that's no longer valid is kept as a `removed` link (history preserved, still associated with its tables).
- **Computed validity**: a relationship is valid iff it has ≥1 active link; "invalid" is computed (no stored validity field).
- **Schema-backup-flow processing**: during schema processing, detect + upsert API-derived relationships per base, run a space-level synced-view inference after all bases are captured, and mark vanished links `removed`.

## Capabilities

### New Capabilities
- `schema-relationships`: the relationship + link data model, API-derived detection during schema processing, link history/removal, computed validity, the confirm/dismiss lifecycle, and the read API.
- `schema-relationships-inference`: the cross-base synced-view inference (field-structure similarity heuristic) that pre-populates `inferred` relationships, run as a space-level step after schema capture.

### Modified Capabilities
<!-- New capabilities; relies on the unarchived system-per-space-db (bo_at_* entities, schema capture). -->

## Impact

- **Per-Space DB**: `bo_at_relationships`, `bo_at_relationship_links`.
- **apps/workflows**: per-base API-derived relationship detection in the `backup-base` schema step; the space-level synced-view inference step.
- **apps/server**: orchestrate the post-capture inference; read API; confirm/dismiss writes.
- No master config (no prompts).
- **Cross-references**: `system-per-space-db` (`bo_at_*` entities, schema capture, link history-via-runs), `server-split-backup-schedules` (runs during schema capture), Browse / the shared entity sidebar (click-through). **UI**: paired ui-only change `relationships-tab`.
</content>
