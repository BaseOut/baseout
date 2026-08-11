## Status

> **2026-07-15 (web-interfaces-source-badge):** the Interfaces tab's read path
> MUST render through `mergeInterfaceSources` + `provenanceBadges`
> (`apps/web/src/lib/interfaces/merge-sources.ts`) — one entity per
> `airtable_entity_id`, MCP row authoritative, manual payload as detail,
> Auto/Manual provenance via the `Badge` primitive. This is the dedupe
> requirement flagged in `server-mcp-interface-pages` task 3.2.


PROPOSED — not yet implemented.

**Blocked on** [`server-automations-interfaces-manual-crud`](../server-automations-interfaces-manual-crud/tasks.md)
(the manual-entry-first slice carved out of the umbrella on 2026-07-09): it ships the engine
read + manual-CRUD routes over per-Space `bo_at_automations`/`bo_at_interfaces` (+ the new
`bo_at_entity_tags` and `interfaces.parent_id`, space schema v6) AND the web client methods +
guarded proxies this change's §1 originally described — §1 below is satisfied by that change;
this change now starts at §0 (Drawer) + §2 (tabs). The old blocker
[`server-automations-interfaces-docs`](../server-automations-interfaces-docs/tasks.md) retains
only the deferred capture funnel (inbound API, script generators, backup reconcile).
No DB / migration / capability-key change here — gates via the existing Schema Docs (Growth+)
tier guard, like the Health and Relationships tabs.

**Round-3 shell note (2026-07-08):** `web-schema-round3-shell` landed (`09949d3`) — the Schema
page now renders per-file tab components under `apps/web/src/views/schema/`, and Automations +
Interfaces each render a soon-gated `SoonTab.astro` placeholder in the **App layer** cluster.
Task 2.1's wiring is therefore two new `views/schema/AutomationsTab.astro` +
`views/schema/InterfacesTab.astro` components replacing those SoonTab entries (lazy-loaded like
`RelationshipsTab.astro`), not radio tabs added to a monolithic `SchemaView.astro`.
Schema-page sequencing: this is the LAST remaining schema slice (largest chain) — after
Changelog UI → Visualize → entity-graph → Insights.

---

## 0. Prerequisite — Drawer primitive

- [ ] 0.1 Add a governed `ui/Drawer.astro` primitive (right-anchored create/edit surface, daisyUI
      `drawer`/`drawer-side` — no bespoke `<style>` where a daisyUI utility exists). Register in
      `component-classification.json`, add `Drawer.stories.ts`, add the `/styleguide` entry in
      `apps/design`. `pnpm --filter @baseout/web audit:components` green.

## 1. Web client + proxy routes (TDD, test-first)

- [ ] 1.1 TDD red: add view types to `backup-engine.ts` — `AutomationView`, `InterfaceView`,
      `AutomationTagView`, `GetAutomationsResult` / `GetInterfacesResult` / `MutateResult`
      (mirroring `GetRelationshipsResult` / `MutateRelationshipResult`). Write the client-method
      tests first, then implement `getAutomations(spaceId, baseId?, includeRemoved?)`,
      `mutateAutomation(spaceId, body)`, `getInterfaces(spaceId, baseId?, includeRemoved?)`,
      `mutateInterface(spaceId, body)` against the engine's read + manual-CRUD routes.
- [ ] 1.2 TDD red: `pages/api/spaces/[spaceId]/automations.test.ts` — GET (list + baseId filter
      + includeRemoved), POST (create), PATCH (edit), DELETE (soft-delete); auth 401, IDOR 403,
      tier 403, invalid-body 400, engine-unconfigured 503, `schemaDocsErrorStatus` mapping. Then
      implement `automations.ts` mirroring
      [`relationships.ts`](../../../apps/web/src/pages/api/spaces/[spaceId]/relationships.ts)
      (`guardSchemaDocsRequest` for auth + IDOR + tier; server-side body/action validation;
      better-auth CSRF on POST/PATCH/DELETE).
- [ ] 1.3 TDD red: `pages/api/spaces/[spaceId]/interfaces.test.ts` — same matrix plus
      `type=page` requires `parentId` (400 when missing). Then implement `interfaces.ts`.

## 2. Tabs & routing (UI)

- [ ] 2.1 New `views/schema/AutomationsTab.astro` + `views/schema/InterfacesTab.astro`
      replacing the two `SoonTab.astro` entries in `SchemaView.astro` (App layer cluster —
      see the round-3 shell note above; lazy-load on first open like `RelationshipsTab.astro`).
      Empty state when `!hasSchema`. Leave the existing live tabs unchanged.
- [ ] 2.2 Below-Growth: render the upsell empty state per tab instead of the listing/form when
      the org lacks Schema Docs (Growth+); 403 from the proxy shows the upgrade affordance.

## 3. Automations tab

- [ ] 3.1 `components/schema/SchemaAutomations.astro` — daisyUI table grouped by **Base**
      (collapsible), columns: name, trigger type, status badge, tag count. Base filter +
      "include removed" toggle; soft-deleted rows muted with a "removed from Airtable" badge,
      hidden unless include-removed. Lazy-fetch on first open + refetch on Base/toggle change.
      `esc()` on all engine strings.
- [ ] 3.2 Create/edit in a right **Drawer** — required Automation ID + Name, optional trigger
      type (fixed Airtable trigger-type list), optional descriptions, and a raw `definition`
      JSON field with a format/validate affordance + client-side JSON validation.
- [ ] 3.3 Table/Field **tag-picker** reusing `EntitySearch.astro`, scoped to the entity's Base;
      tags render as clickable badges (`auto` vs `manual` styled distinctly; only `manual`
      removable; warning badge for a removed target).
- [ ] 3.4 Save / soft-delete via `/api/spaces/[spaceId]/automations` (POST/PATCH/DELETE) with a
      `setButtonLoading` spinner; refetch on success. 403 → upgrade affordance.

## 4. Interfaces tab

- [ ] 4.1 `components/schema/SchemaInterfaces.astro` — Interfaces with their Pages nested one
      level under each Interface; same columns as Automations. Base filter + include-removed;
      orphan pages surfaced. Lazy-fetch + refetch.
- [ ] 4.2 Create/edit Drawer — Interface/Page ID + `type` (`interface | page`) required; a
      `page` requires a **parent-interface picker** (disabled→required when `type=page`); name,
      the same tag-picker, raw `definition` JSON field.
- [ ] 4.3 Save / soft-delete via `/api/spaces/[spaceId]/interfaces` with `setButtonLoading`.

## 5. Governance, stories & fixtures

- [ ] 5.1 Register `SchemaAutomations.astro`, `SchemaInterfaces.astro`, and (if newly ported)
      `EntitySearch.astro` / `EntityPanel.astro` in `component-classification.json`; add a
      sibling `*.stories.ts` and a `/styleguide` entry for each. No `<style>` blocks where a
      daisyUI primitive covers it. `pnpm --filter @baseout/web audit:components` green.
- [ ] 5.2 Fixtures for automations / interfaces / tags (typed against the apps/web view types),
      incl. `empty`, `removed`, page-nested, and below-Growth states — used by stories + tests.

## 6. Verification

- [ ] 6.1 `pnpm --filter @baseout/web typecheck` 0 errors + `build` green + full unit suite green
      (incl. the new proxy + client-method tests). No stray `console.*`.
- [ ] 6.2 Mobile breakpoints checked at <375 / <768 / <1024.

## 7. Human smoke

- [ ] 7.1 **Blocked until** `server-automations-interfaces-docs` ships the engine read +
      manual-CRUD endpoints. Then, on a Growth+ Space with captured schema: open `/schema` →
      Automations → create an automation (ID + Name + trigger + tag a Table/Field) in the Drawer;
      row appears grouped by Base with the tag count; edit persists; soft-delete mutes the row +
      "removed from Airtable" badge; include-removed reveals it. Interfaces → create an interface,
      then a page with that interface as parent; page nests under it. A below-Growth org sees the
      upsell on both tabs. (Engine runs `--remote`; existing Spaces may need re-provision.)

## Deferred follow-ups

- [ ] Reverse tag surfacing on the Browse detail panel (a Table/Field showing the
      Automations/Interfaces that tag it) — leaves the existing Browse tab unchanged in this pass.
- [ ] Structured (non-raw-JSON) `definition` editor — v1 ships raw JSON + format/validate only.
- [ ] Airtable Script / Automation generators (the copy-snippet onboarding path,
      `server-automations-interfaces-docs` Phases C/D).
- [ ] Visualize app-layer graph of automations/interfaces (`visualize-automations-interfaces`).
