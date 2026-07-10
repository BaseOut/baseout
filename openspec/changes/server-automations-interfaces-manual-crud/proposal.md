# server-automations-interfaces-manual-crud — Per-Space manual CRUD for Automations & Interfaces

## Status

PROPOSED — carved out of [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/proposal.md)
(0/40, unbuilt) as the **manual-entry-first** slice (product decision 2026-07-09). This change
unblocks the web Automations/Interfaces tabs, the entity-graph, and the changelog's app-layer
events without the umbrella's inbound-API / script-generator / backup-reconcile phases.

## Why

Airtable's API does not expose Automations or Interfaces, so v1 data is **user-submitted**.
The umbrella change designs the full capture funnel (master `submitted_entities` ledger,
`apps/api` inbound endpoints, Airtable script generators, backup-run reconcile) — but the
Schema page's Automations/Interfaces tabs only need read + manual create/edit/remove, and
every downstream reader (the tabs via web proxies, [`server-schema-entity-graph`](../server-schema-entity-graph/),
the changelog's app-layer events) consumes the **per-Space** `bo_at_automations` /
`bo_at_interfaces` tables, which already exist but are populated by nothing.

This change adds the engine's read + manual-CRUD routes writing those per-Space tables
directly (`submitted_via='manual_form'`), plus the two pieces of per-Space schema the web
spec requires and the tables lack: **entity tags** (tagged Tables/Fields, with the
`auto`/`manual` source distinction) and **page → parent-interface** linkage.

**Layering contract with the deferred umbrella phases:** master `submitted_entities`
becomes an append-only provenance/version ledger only — never the read model. The future
backup-run reconcile (umbrella Phase F) UPSERTs the same per-Space rows
`ON CONFLICT (base_id, airtable_entity_id)`, **preserving the row `id`** (so tags and
page-parent links survive) and replacing only `source='auto'` tag rows — manual rows are
never touched. Nothing in this slice gets reworked when the funnel lands.

## What Changes

- **Per-Space schema v6** (`SPACE_SCHEMA_VERSION` 5 → 6, lazy self-heal via
  `ensureSpaceSchemaCurrent`):
  - New `bo_at_entity_tags` — row-per-tag (modeled on `bo_at_document_tags`):
    `entity_kind ('automation'|'interface')`, `entity_id` (→ the entity row's uuid `id`),
    `target_type ('table'|'field')`, `target_id` (Airtable id),
    `source ('auto'|'manual', default 'manual')`, `added_at`;
    UNIQUE `(entity_kind, entity_id, target_type, target_id)`; indexed both directions
    (by entity for the tabs; by target for reverse surfacing + entity-graph edges).
  - `bo_at_interfaces.parent_id uuid` (nullable) — page → parent interface. Column adds are
    NOT covered by the idempotent CREATE mapper, so a hand-written
    `ALTER TABLE … ADD COLUMN IF NOT EXISTS` is appended in `pg-ddl-upgrade.ts`.
  - Partial UNIQUE `(base_id, airtable_entity_id) WHERE airtable_entity_id IS NOT NULL` on
    both entity tables — 409 on duplicate now; the exact `ON CONFLICT` target Phase F needs later.
- **Engine internal routes** (token-gated, guard chain mirrors `relationships-overview`):
  - `GET /api/internal/spaces/:spaceId/automations?[baseId][&includeRemoved]` →
    `{ ok, automations: [{ id, baseId, airtableEntityId, name, type, definition, status, submittedVia, firstSeenAt, lastSeenAt, tags: [{ id, targetType, targetId, source, targetRemoved }] }] }`
  - `POST /api/internal/spaces/:spaceId/automations/mutate` — `{ action: 'create'|'update'|'remove', … }`
    (create → `submitted_via='manual_form'`, 409 `duplicate_entity`; update replaces only
    `source='manual'` tag rows; remove → `status='removed'` + `last_seen_at=now()` — soft).
  - `GET /api/internal/spaces/:spaceId/interfaces` + `POST …/interfaces/mutate` — same, plus
    `type: 'interface'|'page'` and `parentId` (required + validated for pages: exists, is an
    interface, same base → else 400).
  - Shared io module `automations-interfaces-io.ts` (one module, `kind` param); reuses
    `flagRemovedTags` for the removed-target warning.
- **Web plumbing** (consumed by [`web-automations-interfaces-tabs`](../web-automations-interfaces-tabs/)):
  `backup-engine.ts` view types + `getAutomations` / `mutateAutomation` / `getInterfaces` /
  `mutateInterface`; guarded proxies `pages/api/spaces/[spaceId]/automations.ts` +
  `interfaces.ts` (GET/POST/PATCH/DELETE → action mapping; `guardSchemaDocsRequest`;
  Growth+ tier decision inherited from the web change; CSRF on mutating verbs).

## Capabilities

### New Capabilities

- `automations-interfaces-manual-crud`: engine read + manual create/edit/soft-remove of
  per-Space Automations/Interfaces with tagged Tables/Fields (auto|manual source) and
  page→interface nesting, exposed on INTERNAL_TOKEN-gated routes and guarded web proxies.

## Impact

- `packages/db-schema/src/space/pg.ts` + `sqlite.ts` (parity) — `bo_at_entity_tags`,
  `bo_at_interfaces.parent_id`, partial uniques; `index.ts` `SPACE_SCHEMA_VERSION` → 6;
  regenerate via `scripts/gen-space-pg-ddl.mjs`; `pg-ddl-upgrade.ts` ALTER append.
- `apps/server/src/lib/per-space/automations-interfaces-io.ts` (new) + 4 route files under
  `apps/server/src/pages/api/internal/spaces/` + `index.ts` regex registration.
- `apps/web/src/lib/backup-engine.ts` + `pages/api/spaces/[spaceId]/automations.ts` /
  `interfaces.ts` (+ co-located tests).
- **Unblocks:** `web-automations-interfaces-tabs`, `server-schema-entity-graph` (edges from
  `bo_at_entity_tags`), `server-schema-changelog` §4 app-layer events.
- **Defers (stay in the umbrella):** master `submitted_entities`, apps/api inbound endpoints,
  Airtable script/automation generators, backup-run reconcile, version history.
- **Security:** internal routes only + guarded proxies; parameterized Drizzle throughout;
  soft-delete only (no destructive path); no new secrets.
