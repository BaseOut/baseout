# server-interfaces-normalize — Design

## Context

`server-mcp-interface-pages` (built, smoked 2026-07-14) lands MCP interface captures into a single `bo_at_interfaces` table: one row per app/page/form distinguished by `type`, everything beyond id/name stored verbatim in `definition` jsonb — including `tablesByTableId` with field names, types, and select options that `bo_at_fields` already holds. Its design Decision 1 chose one-table-with-blobs explicitly because per-Space migrations are expensive fleet-wide. The owner reviewed the confirmed capture format (2026-07-18) and reversed that: pre-launch, migrations are cheap now, and the backup representation must be normalized — forms as a first-class table, pages as a real table, and table/field usage stored as ID links. The paired `workflows-mcp-interface-pages` capture side is unaffected (raw envelope forwarded verbatim).

Owner-confirmed envelope shape: `{ interfaces: [{id: pbd…, name, pages: [{id: pag…, interfaceId, name, sourceTableId, tablesByTableId: {tblX: {id, name, fields: [{id, name, type, isEditable, options?}]}}, pageType}]}], standaloneForms: [{id: pag…, interfaceId: null, name, pageType: 'form', sourceTableId, sourceTableName}] }`.

## Goals / Non-Goals

**Goals:**
- Normalized per-Space entity tables (`bo_at_interfaces` apps-only, `bo_at_pages`, `bo_at_forms`) with real columns for parentage, page type, and source table.
- ID-only link tables (`bo_at_page_tables`, `bo_at_page_fields`, `bo_at_form_fields`) — names/types/options always resolved by joining `bo_at_tables`/`bo_at_fields`; page-scoped `is_editable` preserved on the link row.
- Uniform run-based lifecycle (`status` + `first_seen_run`/`first_unseen_run`/`last_seen_run`) on all six tables, with removal-on-confident-capture, cascade, and resurrection semantics.
- Capture hash stable under schema-side field renames (a rename must not dirty interface state).

**Non-Goals:**
- Automation link tables (`bo_at_automation_tables`/`_fields`, `bo_at_page_automations`, `bo_at_form_automations`) — no structured automation capture exists; submission-driven data cannot support confident removal. Table names are reserved here so the naming scheme is settled.
- Web read surfaces (nothing reads `bo_at_interfaces` yet; `merge-sources.ts` contract update rides with the first reader).
- Form field population — `bo_at_form_fields` ships empty until a `get_form_schema` capture path exists.
- Restore/write-back of interfaces; interface content in static file backups (per-Space DB only, unchanged stance).

## Decisions

1. **Three entity tables, not one.** `bo_at_interfaces` keeps only `pbd…` app containers (drops `type`); `bo_at_pages` and `bo_at_forms` are new. Supersedes `server-mcp-interface-pages` Decision 1 — the migration-cost rationale no longer applies pre-launch, and the one-table model forced parentage/pageType/sourceTableId into jsonb where they can't be indexed, joined, or diffed cheaply.
2. **Forms routing: `pageType === 'form'` ⇒ `bo_at_forms`, regardless of parent.** Standalone forms (`interfaceId: null`) and interface-owned form pages both land in `bo_at_forms` (with `interface_id` set when owned); everything else in `pages`. Alternative — only `standaloneForms[]` entries — rejected: "the forms table" would be incomplete and the split would encode envelope structure rather than entity kind. `source_table_name` is dropped (redundant with `bo_at_tables.name`).
3. **One typed link table per relationship, not a universal polymorphic table.** Considered `bo_at_entity_links (source_type, source_id, dest_type, dest_id)` and rejected: per-relationship attributes diverge immediately (`is_editable` today; required/order for forms later; trigger/action roles for automations), lifecycle semantics differ per producer (run-based vs submission-driven), shared blast radius across writers (a scoping bug in one producer corrupts another's rows), weaker typing, and it's customer-visible via Direct SQL/BYODB. New typed link tables later are additive migrations — the cheap kind. One-sided polymorphism (à la `bo_at_document_tags`) was also considered for pages+forms combined and rejected in favor of explicitness since forms are already a separate entity table.
4. **`bo_at_page_tables` exists separately from `bo_at_page_fields`.** A table-level entry in `tablesByTableId` is meaningful even with zero listed fields, and it's the anchor if per-table page attributes appear in the payload later. Uniques: `(page_id, table_id)` / `(page_id, field_id)` / `(form_id, field_id)`; indexes both directions (the reverse lookup — "which pages show this field" — powers change-impact analysis).
5. **Run-based lifecycle replaces timestamps on interface entities.** The shipped rows use `first_seen_at`/`last_seen_at` (the inbound-capture convention) but MCP capture is run-driven — it belongs on the schema-table convention: run-ID columns, timestamps derived by joining `bo_at_base_runs` (time lives only on base_runs). Diff rules inherited from `schema-diff.ts`/`interfaces-sync.ts`: absent-from-successful-capture ⇒ `removed` + `first_unseen_run`; absent/failed capture ⇒ touch nothing (never false-delete); reappearing entity ⇒ back to `active` (`last_seen_run` restamped). **Cascade:** a removed parent (interface → pages/forms; page/form → link rows) marks children removed in the same run, so no active link row ever hangs off a dead parent.
6. **Removed vs unpublished: store the observation, present the interpretation.** Absence of a page/interface from the MCP listing can mean deleted OR unpublished — indistinguishable via the API. The DB records the mechanical truth (`removed` = absent from a confident capture); UI copy for pages/interfaces/forms says "no longer visible (unpublished or deleted)". A dedicated `unpublished` status was rejected: it encodes a guess that will be wrong customer-visibly. Link rows under a still-present parent are unambiguous — plain "removed".
7. **Definition slimming + rename-stable hash.** Entity rows keep a `definition` jsonb for unknown-key pass-through (envelope-tolerance invariant preserved), but known keys that normalized into columns/links — `pages`, `tablesByTableId`, `interfaceId`, `pageType`, `sourceTableId`, `sourceTableName` — are stripped before persist. The capture hash is computed over the normalized representation (entity columns + link IDs + `is_editable` + slimmed definition), so a schema-side field rename no longer breaks the short-circuit or refreshes definitions.
8. **Dual-source model: apps only.** MCP diffing stays source-scoped (`submitted_via='mcp'`). Manual submissions continue to target `bo_at_interfaces` (app-level context is what humans submit); whether manual intake ever writes pages/forms rows is deferred to the manual-crud change. `bo_at_pages`/`bo_at_forms` keep a `submitted_via` column so that door stays open without a migration.
9. **Changelog entity types widen.** `bo_at_schema_updates` rows use `entity_type` `interface` | `page` | `form` (was: `interface` for everything). Name changes → `change_type='name'`; composition (page_type, source_table_id, link add/remove summary, `is_editable` flips) → `change_type='config'` storing the delta. `server-schema-changelog`'s type union widening is a noted dependency, matching its existing 4.3 caveat.
10. **Destructive migration is acceptable.** Pre-launch: the migration drops/recreates interface-related rows rather than transforming them; existing dev/staging Spaces repopulate on their next backup run (capture is idempotent and full). `SPACE_SCHEMA_VERSION` bump drives the lazy on-access migrator on all backends; PG and SQLite migrations land together with the parity tests extended to the five new tables.

## Risks / Trade-offs

- [Airtable evolves the envelope] → unknown keys still pass through into slimmed `definition`; extraction validates only id+name per entity (unchanged invariant); destructive envelope changes degrade to add/remove noise, observable in the changelog.
- [Link-row volume: pages × fields rows rewritten as lifecycle rows] → bounded (a page lists tens of fields); diff computes set deltas so unchanged links are stamp-only updates; hash short-circuit skips all of it in the common no-change case.
- [Hash change definition means every existing Space diffs "everything changed" once] → first post-migrate run re-inserts fresh rows into empty tables — no spurious `schema_updates` rows because there is no prior working set (migration dropped it).
- [Cascade bug could mass-remove links] → cascade is scoped to parents marked removed in the same diff, unit-tested with resurrection round-trips; failed captures never enter the diff path at all.
- [`bo_at_form_fields` ships empty — dead table risk] → deliberate: settles naming/shape now so form-schema capture is additive; documented in the spec as populated-when-available.

## Migration Plan

1. Land `packages/db-schema` changes (both dialects + migrations + parity tests + `SPACE_SCHEMA_VERSION` bump).
2. Land `apps/server` sync rework in the same change (the old writer targets dropped columns — they deploy together).
3. Deployed smoke on dev: hand-POST the owner fixture → inspect the six tables → mutate → verify lifecycle/cascade/resurrection → absent field → identical capture short-circuit.
4. Rollback: revert both; per-Space DBs re-migrate down is NOT supported — pre-launch, a broken migrate is fixed forward (drop/recreate is acceptable on dev/staging data).

## Open Questions

| # | Question | Default answer |
|---|---|---|
| Q1 | Should interface-owned form pages ALSO get a stub row in `bo_at_pages` (so an interface's page list is complete in one table)? | No — one entity, one home; interface page listings UNION pages+forms by `interface_id`. |
| Q2 | Manual page/form submissions | Deferred to `server-automations-interfaces-manual-crud`; `submitted_via` column reserved on both tables. |
| Q3 | Does `get_form_schema` expose required/order per field? | Unknown until sampled; `bo_at_form_fields` starts with `is_editable` and grows additively. |
