## Context

The engine already stores, per Space, the Base/Table/Field schema (read by `schema-read` / `relationships-overview`) and the user-submitted Automations + Interfaces (`submitted_entities`, from [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/)). Nothing joins those two into a single cross-entity graph. This change adds a **read-time** builder that assembles one node/edge graph per Space and exposes it on an internal route the web Visualize tab proxies. It writes nothing.

## Goals / Non-Goals

**Goals:**
- Assemble a single, typed node/edge graph the web can render on the existing React Flow canvas with no client-side stitching.
- Cover the three edge kinds the Visualize spec calls for: `references`, `reads`, `triggers`.
- Keep soft-deleted (removed) entities in the graph with a `status` marker so history stays visible.
- Reuse the exact readiness/IDOR guards + `withSpaceSchema` read path as `relationships-overview`.

**Non-Goals:**
- The Data (ER) and Relationships Visualize modes — those reuse existing `getSchema` / `getRelationships`; this route is only for the Automations & Interfaces mode.
- Any write, mutation, or lifecycle (confirm/dismiss). Read-only.
- A Trigger.dev task or any background/cron assembly — the builder runs synchronously per request inside the Worker's wall-clock budget.
- Client-side graph assembly, force-directed layout, or layout math (the web owns layout via dagre).

## Graph data model

### Node kinds
| kind | source | id shape | notes |
| --- | --- | --- | --- |
| `automation` | `submitted_entities` where `entity_type='automation'` | `airtable_entity_id` (or synthetic) | an Airtable Automation |
| `interface` | `submitted_entities` where `entity_type='interface'` | interface id from payload | an Interface (container of pages) |
| `page` | interface payload → pages | `interfaceId:pageId` | a page within an Interface |
| `table` | per-Space Base/Table schema | Airtable table id | maps to an Airtable Table |
| `field` | per-Space Field schema | Airtable field id | maps to an Airtable Field |

Every node carries: `id`, `kind`, `label`, `baseId` (nullable for cross-base automations), and `status` (`active` | `removed`). `status='removed'` when the underlying entity is soft-deleted (Table/Field removed from Airtable, or the submitted entity marked removed).

### Edge kinds
| kind | direction | meaning |
| --- | --- | --- |
| `references` | `automation → table` \| `automation → field` | the automation reads/writes that Table/Field |
| `reads` | `page → table` \| `page → field` | the interface page reads that Table/Field |
| `triggers` | `page → automation` \| `interface → automation` | the page/interface triggers that automation |

Each edge carries: `id`, `kind`, `source`, `target`, and `status` (inherited as `removed` when either endpoint is removed, so the web can mute the edge).

### Assembly outline (pure function)
`buildEntityGraph({ automations, interfaces, tables, fields })`:
1. Emit `table` + `field` nodes from the per-Space schema (dedup by Airtable id).
2. Emit `automation` nodes from submitted automations; for each Table/Field the automation payload references, emit a `references` edge (skip references to unknown/removed ids by re-pointing to the removed node, not dropping — history stays visible).
3. Emit `interface` + `page` nodes from submitted interfaces; for each page's Table/Field reads, emit a `reads` edge.
4. For each page/interface that names a triggered automation, emit a `triggers` edge (empty set until payloads carry it — see the deferred follow-up).
5. Propagate `status='removed'` to edges whose endpoints are removed.

The builder takes injected plain data (no DB handle) so it unit-tests without Postgres — the route calls it inside `withSpaceSchema` after loading the rows.

## Decisions

### D1 — Read-time in the Worker, no task
Assembly is a pure fold over already-stored rows; it fits the Worker wall-clock budget and needs no Trigger.dev task or cache. If a Space ever grows large enough to blow the budget, revisit with a materialized graph table — flagged, not built.

### D2 — Removed entities stay in the graph
Consistent with the Relationships tab and the Automations/Interfaces tabs: soft-deleted Tables/Fields/entities render muted rather than disappearing. The builder re-points edges at the removed node and marks `status='removed'` rather than dropping the edge.

### D3 — Single payload, no pagination
One `{ nodes, edges }` payload per Space. The web filters (Base, node type, field visibility) client-side. Server-side base filtering is a deferred follow-up gated on real payload sizes.

### D4 — Mirror `relationships-overview` guards exactly
Reuse `resolveSpaceDb` → `active` + `managed_pg` check → `ensureSpaceSchemaCurrent` → `withSpaceSchema`. Same error codes (`space_db_not_ready` 409, `backend_not_implemented` 501, `read_failed` 500) so the web proxy's `schemaDocsErrorStatus` mapping needs no new cases.

## Risks / Trade-offs

- **`triggers` edges empty until captured** — the edge kind ships and renders on demand; the graph is useful from day one on `references` / `reads`. Flagged, not blocking.
- **Graph scale** (many automations × fields) → the web collapses Field-under-Table and filters by Base/type; if the raw payload itself gets heavy, D3's server-side base filter becomes the follow-up.
- **Unknown/removed id references** in submitted payloads → re-point to a removed node rather than dropping, so a stale automation still shows what it *used* to touch.

## Open Questions

- Should `page` nodes always be emitted, or only when they carry at least one `reads`/`triggers` edge? Leaning "only connected pages" to keep the graph legible; confirm against a real interface payload.
- Directionality of the `triggers` edge (single `page → automation` vs. bidirectional) — leaning single, matching the web design's leaning. Confirm in design review.
