## Context

The Schema page (`apps/design/specs/10-schema.md`, `apps/web` `SchemaView`) renders only what a backup run can collect. Automations and Interfaces aren't in Airtable's REST/Metadata API ([PRD §2.9](../../../shared/Baseout_PRD.md)), so they need a manual/inbound intake. The per-Space DB already carries `bo_at_automations` and `bo_at_interfaces` (shipped under `SPACE_SCHEMA_VERSION`), each shaped as `{ id, baseId, airtableEntityId, name, type, definition jsonb, status, submittedVia, firstSeen/lastSeen }`. The per-Space DB is reachable only from the engine (`apps/server`) via `withSpaceSchema` + the `x-internal-token` gate; `apps/web` and `apps/api` broker through it — exactly the pattern `shared-schema-docs` established for documents. This change layers a feature onto that shipped storage rather than designing new storage.

Two intake paths are in scope: a manual UI form (Schema tabs) and an inbound REST API (`apps/api`, Org API token). Both converge on the same payload shape and the same engine broker write path. Other paths named in PRD §2.9 (Airtable Script/Automation generators) are deferred.

## Goals / Non-Goals

**Goals:**
- Build Automations + Interfaces as two new Schema tabs with create/edit/delete by hand.
- Accept the identical payload from an inbound REST API so customers can scrape and POST their environment.
- Link automations/interfaces to the Tables/Fields they reference (auto-extracted from `definition` + manual), surfacing the link on both sides.
- Keep the data model deliberately shallow: required scalars as columns, full config as opaque `definition` JSONB.
- Route every per-Space write through the existing engine broker; never let `apps/web`/`apps/api` touch the per-Space DB directly.

**Non-Goals:**
- Per-step / per-config-type relational modeling of automations or interface pages.
- Custom-documentation intake (the third entity in the superseded change) — separate follow-up.
- Airtable Script and Airtable Automation generator snippets (PRD §2.9 intake paths 2 & 3) — deferred.
- AI summarization/health of automations — V2.
- Editing the `definition` blob field-by-field in the UI (raw JSON / advanced textarea only for v1).

## Decisions

### D1 — Hybrid model on the shipped per-Space tables (not master DB, not granular)
Reuse `bo_at_automations` / `bo_at_interfaces` as-is, adding only `parentInterfaceId text` to `bo_at_interfaces` (a `page` references its parent `interface`). Required scalars stay columns; everything else stays in `definition` JSONB.
- *Why over master-DB `submitted_entities`* (the `server-automations-interfaces-docs` design): per-Space tables already shipped, respect tenant isolation, and sit next to the `bo_at_tables`/`bo_at_fields` rows that tags point at — cross-DB tagging would otherwise be impossible. That change is superseded.
- *Why over full granular modeling*: Airtable has dozens of trigger/action/element types and adds more; modeling each is brittle and high-cost for a read-mostly intelligence surface. Opaque `definition` absorbs new types for free.

### D2 — New `bo_at_entity_tags` table (generalize the document-tag pattern)
```
bo_at_entity_tags:
  id uuid pk,
  source_type text not null,   -- 'automation' | 'interface'
  source_id   uuid not null,   -- → bo_at_automations.id | bo_at_interfaces.id
  target_type text not null,   -- 'table' | 'field'
  target_id   text not null,   -- Airtable entity id (matches bo_at_tables/fields.airtable id)
  added_via   text,            -- 'auto' | 'manual'
  indexes: (source_type, source_id), (target_type, target_id),
  unique: (source_type, source_id, target_type, target_id)
```
Mirrors `bo_at_document_tags` (proven shape) rather than inventing a new convention. A single table serves both automations and interfaces via `source_type`.
- *Alternative rejected*: reusing `bo_at_document_tags` directly — its `target_type` is the *tagged* entity and its source is always a document; overloading it would muddy the docs feature. Separate table, same shape.

### D3 — Auto-extraction is a deterministic walk over `definition`, re-run on every write
On create/edit (UI or API), a pure helper walks `definition` for known reference keys, resolves names→ids against the Space's current `bo_at_tables`/`bo_at_fields`, and upserts `added_via='auto'` tags; manual (`added_via='manual'`) tags are never clobbered. Unresolvable references (name not found, e.g. renamed table) are skipped, not errored — they may resolve on a later schema sync. The reference map is config-driven per entity type, confirmed against both example payloads:
- **Automations**: `trigger.table`, `actions[].table` (→ Table), `actions[].fields` keys and condition `field` names (→ Field). Dynamic `{tokens}` are ignored.
- **Interfaces**: a page's `sourceTable` (→ Table) and `detailFieldsShown[]` (→ Field).
- *Why re-run on every write*: `definition` is the source of truth; recomputing keeps auto-tags consistent without a migration/backfill job. Manual tags are additive and preserved.

### D4 — Engine broker owns all per-Space I/O; web + api are thin proxies
`apps/server` exposes `x-internal-token`-gated `/api/internal/spaces/:spaceId/{automations,interfaces}` (GET list, POST create, PUT update, DELETE). `apps/web` proxies via authenticated, IDOR-checked, capability-gated `/api/spaces/[spaceId]/*` routes (session → org→space ownership). `apps/api` validates the Org API token, resolves its Space, tier-gates, then forwards over the HMAC service token. Tag auto-extraction runs inside the engine so both intake paths get identical behavior.
- *Why centralize in the engine*: single write path = one place for validation, tag extraction, and `firstSeen/lastSeen`/`version` bookkeeping; matches `shared-schema-docs`.

### D4a — Interface ID mapping and nested-payload flattening
The interfaces payload nests pages inside their interface (`interfaces[].pages[]`) and uses distinct id prefixes: interface own-id = `interfaceId` (`pbd…`), page own-id = `pageId` (`pag…`), and a page's `interfaceId` field is its **parent**. The engine SHALL flatten a nested submission into one `bo_at_interfaces` row per interface plus one row per page, mapping `airtableEntityId` = own id (`interfaceId` for interfaces, `pageId` for pages) and `parentInterfaceId` = the parent `interfaceId` for pages (null for interfaces). All other fields (`published`, `lastPublished`, `hasUnpublishedChanges`, `order`, `iconLabel`, `pageCount`, `layout`, `sourceTable`, `detailFieldsShown`, `notes`) live in the opaque `definition`.
- *Why flatten*: storage is one flat table; a nested submission and a flat per-entity submission must produce identical rows so the UI form and a scraped nested blob converge.

### D5 — UI is a paired UI-only change
The two Schema tabs (listings, create/edit/delete forms, tag-picker, upsell) are specced and built in the `ui-only` repo (`automations-interfaces-tabs`), consuming this change's `apps/web` proxy routes. This change owns no tab views/components — only the proxy + capability wiring the UI calls. Keeps each repo owning its half (UI intent vs. backend/data).

### D7 — Delete is soft (`status='removed'`), history retained
Delete (UI or inbound API) SHALL set `status='removed'` rather than dropping the row. Removed entities are excluded from default reads but retained, and their `bo_at_entity_tags` are kept so historical links survive — consistent with how `shared-schema-docs` treats tags whose entity was later removed. A re-submission of the same `airtableEntityId` reactivates the row (`status='active'`).
- *Why soft*: automations/interfaces are an intelligence/audit surface; a hard delete would erase the cross-entity history the graph/Browse surfaces are built to show. Purge, if ever needed, is a separate admin concern.

### D6 — Tier gate at Growth+ (PRD reading)
A `automationsInterfaces` capability (`none | manual`) resolved from cached Stripe metadata. Below Growth → `402`/`403` from both proxy and inbound API (the UI renders its own upsell). Flagged divergence with Features §4.2 ("Launch+") for product reconciliation; PRD §2.9 wins per CLAUDE.md.

## Risks / Trade-offs

- **Auto-extraction misses references** (renamed/removed tables, dynamic `{tokens}`) → tags resolve best-effort; manual tag-picker is the escape hatch; unresolved refs retried on next write. Never block the write on extraction failure.
- **`definition` is opaque** → can't query "all automations that send email" in SQL. Accepted: this is a read/browse intelligence surface, not an analytics one; revisit in V2 if needed.
- **Two intake paths, one shape drift risk** → both share one Zod schema in `@baseout/shared` and one engine write path; contract tested on both sides.
- **Superseding an unstarted change** → `server-automations-interfaces-docs` (0/40) + `workflows-automations-interfaces-docs` (0/5) are re-scoped/archived, not deleted silently; custom-documentation intake carved out for a future change so nothing is lost.
- **Nested vs flat interface submissions** → a scraped blob nests pages under interfaces; the flatten step (D4a) is the single normalization point and is contract-tested so both shapes converge on identical rows.

## Migration Plan

1. `packages/db-schema`: add `parentInterfaceId` + `bo_at_entity_tags`, bump `SPACE_SCHEMA_VERSION`, update pg/sqlite/pg-ddl + parity tests. Per-Space DBs migrate forward on next schema sync (additive, no backfill).
2. Engine broker routes + tag walker + tests (TDD).
3. `apps/api` inbound routes + auth/tier gate + tests.
4. `apps/web` proxy routes + capability + tests.
5. Re-scope/archive the superseded changes.
- The Schema tab UI ships via the paired `ui-only` change `automations-interfaces-tabs` (out of scope here).
- **Rollback**: additive schema columns/table are inert if the capability is off. No destructive migration.

## Open Questions

- Reconcile the Growth+ vs Launch+ tier divergence with product before launch (PRD §2.9 used here).
