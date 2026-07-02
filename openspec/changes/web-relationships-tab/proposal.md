## Why

The engine now exposes a relationship graph ([`server-relationships`](../server-relationships/)) — API-derived relationships + inferred synced-view candidates with a confirm/dismiss lifecycle — but nothing surfaces it. The ui-only [`relationships-tab`](../../../) spec defines a **Relationships** tab on the Schema page that lists relationships grouped by base + type, shows validity / inferred / removed badges, and lets users confirm/dismiss inferred synced views. This change adds that tab.

## What Changes

- A new **Relationships** tab on `/schema` (after Browse, before Health). Per **base**: API-derived relationships **grouped by type** (linked records, formulas, rollups, lookups, lastModified) + a **synced views** section. Each row shows a label, a **validity** badge (invalid), a **removed-history** badge, and (for synced views) **inferred / confirmed / manual** status.
- **Confirm / Dismiss** actions on inferred synced views (POST → re-fetch). API-derived relationships have no actions.
- An **"include removed / dismissed"** toggle reveals invalid derived relationships + dismissed candidates (the read forwards `includeDismissed`).
- The tab **lazy-loads** per base on first open + refetches on base change / toggle.
- **Launch+ gating** reuses the Schema Docs tier guard (no new capability key), like the Health tab.
- New web client methods `getRelationships` / `mutateRelationship` + proxy routes `/relationships` (GET) and `/relationship-mutate` (POST).

## Capabilities

### New Capabilities
- `relationships-tab`: the read-only-plus-confirm/dismiss Relationships view — grouped-by-type list, validity/inferred/removed badges, synced-view confirm/dismiss/create, Launch+ gated.

### Modified Capabilities
<!-- Adds a tab to the Schema page; consumes server-relationships. No new DB/migration/capability-key. -->

## Impact

- `apps/web/src/lib/backup-engine.ts` — `getRelationships` / `mutateRelationship` + view types.
- `apps/web/src/pages/api/spaces/[spaceId]/relationships.ts` (GET) + `relationship-mutate.ts` (POST) — guarded proxies.
- [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — the Relationships tab (base picker + include-removed toggle + grouped render + confirm/dismiss).
- **Pairs with** `server-relationships` + `workflows-relationship-inference`.
- **Deferred follow-ups:** click-through to the shared entity-detail sidebar (cross-tab), a full faceted filter bar (base/type/status/validity flat mode), and a user-created-synced-view picker (the `create` action exists engine-side but has no UI yet). No DB/migration/capability-key change.
