## Context

`shared-automations-interfaces` lands the per-Space data: `bo_at_automations`, `bo_at_interfaces` (with `parent_interface_id`), and `bo_at_entity_tags` (`source_type ∈ automation|interface`, `target_type ∈ table|field`), plus an engine broker and web proxy gated at Growth+. The Visualize tab renders a React Flow schema canvas; the designer is adding a mode menu (Data / Relationships). This change adds a third mode that draws the automations/interfaces web, and captures the one edge type the data model doesn't yet hold: interface/page → automation.

The per-Space DB is engine-only; web reads through the broker. The graph is read-mostly, so the engine assembles it server-side and hands the client one typed payload.

## Goals / Non-Goals

**Goals:**
- A Visualize-mode graph of Automations, Interfaces, Pages, Tables, Fields and the edges between them.
- Capture page/interface→automation links so that edge is drawable.
- Single engine-assembled read payload; client renders, doesn't stitch.
- Reuse the existing React Flow island and entity detail-panel click-through; respect daisyUI-first governance (React Flow is the sanctioned carve-out, per `shared-schema-docs`).
- Keep removed entities visible (muted) so the graph doubles as history.

**Non-Goals:**
- The Data and Relationships modes themselves (designer / `server-schema-relationships`); this change only registers an additional mode.
- Any new DB table or migration.
- Editing automations/interfaces from the graph (that's the tabs from `shared-automations-interfaces`).
- Graph layout sophistication beyond a readable structural layout (no force-directed "hairball" — same guidance as the Visualize spec).
- Cross-Space graphs; the graph is per-Space, filterable by Base.

## Decisions

### D1 — Reuse `bo_at_entity_tags` for automation edges (no schema change)
The interface/page→automation edge is stored as `bo_at_entity_tags { source_type:'interface', source_id:<interface/page row id>, target_type:'automation', target_id:<automation airtableEntityId>, added_via }`. `target_type` is free-text in the shipped schema, so no migration is needed — only application-layer validation gains `'automation'` as an accepted value.
- *Why over a new edge table*: the tag table already models typed entity→entity links with `added_via` and history; a second table would duplicate it. *Why `target_id` = automation's `airtableEntityId`* (not row uuid): it's the stable cross-reference that survives re-submission/upsert, matching how table/field targets use Airtable ids.

### D2 — Automation-reference extraction during intake (best-effort, additive)
Extend the `shared-automations-interfaces` extraction walker: when an interface/page `definition` contains an automation reference (e.g. a button/element configured to run an automation), resolve it to an automation in the same Space+Base and upsert an `added_via='auto'` automation-target tag. Manual tags via the UI tag-picker / inbound API are also accepted (`added_via='manual'`). Unresolvable references are skipped, never fatal — consistent with table/field extraction.
- *Caveat*: the current scraped interface JSON does not yet include run-automation config; the walker's reference path is config-driven and will populate edges once that field is scraped or added manually. The graph renders whatever links exist.

### D3 — Engine assembles the graph; one typed payload
`GET /api/internal/spaces/:spaceId/entity-graph` (optionally `?baseId=`) returns:
```
{ nodes: [{ id, type: 'automation'|'interface'|'page'|'table'|'field', label, status, baseId, ... }],
  edges: [{ source, target, kind: 'references'|'reads'|'triggers', addedVia }] }
```
Built from one per-Space read joining `bo_at_automations` + `bo_at_interfaces` + `bo_at_entity_tags` (+ `bo_at_tables`/`bo_at_fields` for labels). Node ids are namespaced by type to avoid collisions.
- *Why server-side*: a graph needs all entities + all links at once; doing it in the engine is one query and one IDOR/capability check, versus the client firing N list calls and joining. Matches the broker pattern.

### D4 — The graph UI is a paired UI-only change
The Visualize "Automations & Interfaces" React Flow mode (rendering, node/edge styling, filters, legend, click-through, menu-mode-vs-toggle registration) is specced and built in the `ui-only` repo (`visualize-automations-interfaces`), consuming this change's proxy. This change owns the payload contract + read path only.

### D5 — Removed entities stay in the payload
The read includes `status='removed'` entities rather than dropping them, so the UI can render historical wiring — consistent with the soft-delete decision in `shared-automations-interfaces`. How they're displayed (muted, toggle) is the UI-only change's concern.

## Risks / Trade-offs

- **Graph readability at scale** (a base with dozens of automations × many fields) → default to a grouped/structural layout, collapse Field nodes under their Table until expanded, and filter by Base/type. Avoid force-directed layouts.
- **page→automation data is empty until scraped/entered** → the edge kind ships and renders on demand; the graph is useful from day one on table/field edges and gains automation edges as data arrives. Flagged, not blocking.
- **Depends on an unstarted change** → if `shared-automations-interfaces` shifts its tag shape, this change's extraction/read must track it; mitigated by both being authored together and this one only *adding* a `target_type` value + a read endpoint.
- **Menu host not yet specced** → handled in the paired UI-only change (self-contained toggle fallback); doesn't affect this change's payload/read contract.

## Migration Plan

1. (Precondition) `shared-automations-interfaces` applied — entity-tags, broker, proxy, capability.
2. Engine: extend extraction to emit `target_type='automation'`; allow the value in validation; add `entity-graph` assembly + internal route + tests.
3. `apps/api`: accept automation-target link entries on the interface payload + tests.
4. `apps/web`: graph proxy route + engine-client method + tests.
5. The Visualize graph UI ships via the paired `ui-only` change `visualize-automations-interfaces` (out of scope here).
- **Rollback**: read endpoint is additive and inert if unused; `target_type='automation'` tags are ignored by surfaces that filter on table/field. No destructive change.

## Open Questions

- Exact `definition` path that encodes "this interface element runs automation X" — pending a scraped example; D2's walker is config-driven so it's a one-line map addition when known.
