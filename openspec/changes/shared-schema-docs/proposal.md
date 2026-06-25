## Why

The per-Space DB already ships four tables for user-authored schema documentation — `bo_at_documents`, `bo_at_document_tags`, `bo_at_document_links`, `bo_at_document_diagrams` (landed in `1e21300`, `SPACE_SCHEMA_VERSION=2`) — plus the storage-layer "Schema documents" requirement in [`system-per-space-db`](../system-per-space-db/specs/per-space-db/spec.md). But there is no engine read/write path and no UI: the storage shipped ahead of the feature.

Two spec divergences block building it cleanly:

- [`shared/Baseout_PRD.md`](../../../shared/Baseout_PRD.md) §3.7 marks "Data Dictionary / Documentation" as **V2**, while [`shared/Baseout_Features.md`](../../../shared/Baseout_Features.md) §7 already gates "Schema Documentation" as a **V1** capability (Launch+ manual, Pro+ AI). The seam: *user-authored manual docs are V1*; *auto-generated dictionaries + exports stay V2*.
- The schema page is designed as Visualize / Changelog / Health ([`apps/design/specs/10-schema.md`](../../../apps/design/specs/10-schema.md)) with Documentation listed out-of-scope; no Browse/Docs tab is designed, and the `ui-only/overview/schema/05-docs-tab.md` that `system-per-space-db/tasks.md` references does not exist in any branch.

This change promotes user-authored Schema Docs to a built V1 capability, reconciles the specs, and implements the engine brokering + web UI.

## What Changes

- **Reconcile specs**: split PRD §3.7 (user-authored Schema Docs = V1; auto-generated dictionary/exports = V2); add naming-dictionary entries (Document, Docs tab, Browse tab, Tag, External Link, Mini-Diagram); update the schema design spec; author the Browse/Docs UI spec.
- **`apps/server`**: per-Space document CRUD + read-broker internal routes, mirroring the schema-sync handler + `withSpaceSchema` + `x-internal-token` gate. The engine treats the Plate `body` and React Flow `state` as opaque JSONB.
- **`apps/web`**: typed engine-client methods; authenticated, IDOR- and capability-gated `/api/spaces/[spaceId]/*` proxy routes; a `SchemaView` with Browse + Docs tabs replacing the placeholder.
- **`apps/web` React islands**: add `@astrojs/react` + Plate + React Flow; `DocBodyEditor` (rich text + `@`-tags) and `DocDiagram` (mini-diagrams) as `.tsx` islands, with a documented governance carve-out (daisyUI provides no rich-text editor or node graph).
- **Tier gating**: a `schemaDocs` capability (`none` / `manual` / `manual_ai`) resolved from cached Stripe metadata.
- **AI generation gated "soon"** — deferred to a follow-up `server-schema-ai-docs` change (Workers-AI binding, sovereign field-names-only prompt, AI quota).

## Capabilities

### New Capabilities
- `schema-docs`: customers author rich-text documents about their Airtable schema, tag them to entities (surfacing on entity detail panels), attach external links, and save mini-diagrams — all brokered by the engine and tier-gated.

### Modified Capabilities
<!-- The per-space-db storage-layer "Schema documents" requirement is unchanged; this change serves it via the engine read/write broker. No table change. -->

## Impact

- `shared/Baseout_PRD.md` §3.7 — scope split (the stale `apps/web/docs/` duplicate is flagged for a separate cleanup, not edited here)
- `shared/Baseout_Features.md` §1 — naming-dictionary additions
- `apps/design/specs/10-schema.md` + new `apps/design/specs/10a-schema-docs.md` — UI design (the `ui-only/overview/schema/05-docs-tab.md` path referenced in `system-per-space-db/tasks.md` is in a separate repo and does not exist; authored in-repo instead)
- `apps/server/src/lib/per-space/documents.ts` (new) + `pages/api/internal/spaces/{documents,document,docs-by-entity}.ts` (new) + `index.ts` (route registration)
- `apps/web/src/lib/backup-engine.ts` + `pages/api/spaces/[spaceId]/{documents,documents/[docId],docs-by-entity}.ts` (new) + `views/SchemaView.astro` (new) + `pages/schema.astro` + `components/islands/*.tsx` (new) + `package.json` + `astro.config.mjs`
- `apps/web/src/lib/capabilities/tier-capabilities.ts` — additive `schemaDocs` field
- **Precondition (shipped, not in scope):** `packages/db-schema/src/space/{pg,sqlite}.ts` document tables
