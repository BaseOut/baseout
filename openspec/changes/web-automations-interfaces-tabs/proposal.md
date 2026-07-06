## Why

Airtable's REST API doesn't expose **Automations** or **Interfaces**, so the engine
captures them through a manual-intake path — [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/proposal.md)
adds the `submitted_entities` master table + inbound POST endpoints
(`v1/spaces/:id/automations|interfaces|documentation`), and
[`workflows-automations-interfaces-docs`](../workflows-automations-interfaces-docs/proposal.md)
finalizes the per-Base blob during a backup run. But nothing in the customer UI
surfaces those entities yet — the workflows proposal explicitly defers
"Rendering the docs blob in apps/web" to a separate apps/web change, and this is it.

The ui-only [`automations-interfaces-tabs`](../../../) spec designs two new tabs on the
Schema page: an **Automations** tab (grouped by Base, name / trigger / status / tag-count
rows, create/edit in a right Drawer, soft-deleted rows muted as "removed from Airtable")
and an **Interfaces** tab (Interfaces with their child Pages nested, `interface | page`
type, a parent-interface picker for pages). Both reuse the shared Table/Field tag-picker
(EntitySearch) so an entity's tagged Tables/Fields render as clickable badges, bidirectional
with the Browse tab. Below Growth, each tab shows an upsell empty state. This change adds
those two tabs and the guarded web proxy routes they read + write through.

**Hard dependency:** this web UI is **blocked** until
[`server-automations-interfaces-docs`](../server-automations-interfaces-docs/proposal.md)
ships the engine's automations/interfaces **read** + **manual-create** endpoints. That
change is currently **0/9 (UNBUILT)**. The web tabs cannot list or persist entities
without the engine read + manual-CRUD routes it delivers; build order is engine-first,
then this change wires the tabs against it.

**Tier conflict already resolved by the engine change** (flagged here per CLAUDE.md
"v1.1 PRD authoritative"): [PRD §2.9](../../../shared/Baseout_PRD.md) puts Automations +
Interfaces at **Growth+**; [Features §4.2](../../../shared/Baseout_Features.md) reads Launch+.
`server-automations-interfaces-docs` commits to **Growth+** (PRD reading). This change
reuses that resolver via the existing `guardSchemaDocsRequest` tier guard — it introduces
no new tier decision of its own.

## What Changes

- Add an **Automations** tab and an **Interfaces** tab to `/schema` (Schema page tab order
  grows; leave the existing 5 tabs untouched per "don't refactor what works").
- **Automations tab** — a list grouped by **Base** (collapsible sections), each row showing
  name, trigger type, status badge (`active` / `removed`), and a count of tagged Tables/Fields.
  Create/edit opens in a right **Drawer** capturing the required scalars (Automation ID, Name),
  optional trigger type, optional descriptions, and a raw `definition` JSON field, plus the
  shared **Table/Field tag-picker**. **Delete is soft** — the row goes muted with a
  "removed from Airtable" badge rather than vanishing.
- **Interfaces tab** — a list of Interfaces with their child **Pages** nested one level under
  each Interface. The Drawer captures Interface/Page ID and `type` (`interface | page`); a
  `page` requires a **parent-interface picker**; plus name, the same tag-picker, and a raw
  `definition` JSON field.
- **Bidirectional tag surfacing** — an entity's tagged Tables/Fields render as clickable
  badges (`auto` vs `manual` styled distinctly; only `manual` removable). A tag whose target
  entity was removed shows a warning badge, never silently dropped. (Reverse surfacing on the
  Browse detail panel — a Table/Field showing the Automations/Interfaces that tag it — is a
  deferred follow-up so the existing Browse tab is not reshaped in this change.)
- **Base filter + include-removed toggle** — filter the listing by Base; an "include removed"
  toggle reveals soft-deleted rows (muted). Lazy-load per tab on first open, refetch on
  Base/toggle change.
- **Below-Growth upsell** — each tab renders an upsell empty state instead of the listing/form
  when the org lacks the Schema Docs (Growth+) entitlement; the proxy returns 403 and the tab
  shows an upgrade affordance.
- **New web client methods** `getAutomations` / `mutateAutomation` / `getInterfaces` /
  `mutateInterface` on `backup-engine.ts` + **guarded proxy routes**
  `/api/spaces/[spaceId]/automations` and `/api/spaces/[spaceId]/interfaces`
  (GET / POST / PATCH / DELETE), each behind the `guardSchemaDocsRequest` (auth + IDOR + tier)
  pattern, with server-side validation and better-auth CSRF on the mutating verbs.
- **Loading states** — every create/edit/delete shows a spinner via `setButtonLoading`.

## Capabilities

### New Capabilities
- `automations-interfaces-tabs`: the Automations and Interfaces Schema tabs — Base-grouped /
  Page-nested listings, the create/edit Drawer (required scalars + Table/Field tag-picker +
  raw `definition`), page→parent linking, soft-delete rendering, clickable bidirectional tags,
  Base filter + include-removed, the below-Growth upsell, and the guarded read + manual-CRUD
  proxy routes it reads/writes through.

### Modified Capabilities
<!-- Adds two tabs to the Schema page; consumes server-automations-interfaces-docs. No new
     DB/migration/capability-key in this change — gates via the existing Schema Docs
     (Growth+) tier guard, like the Health and Relationships tabs. -->

## Impact

- `apps/web/src/lib/backup-engine.ts` — `getAutomations` / `mutateAutomation` /
  `getInterfaces` / `mutateInterface` client methods + view types
  (`AutomationView` / `InterfaceView` / `AutomationTagView` / results), mirroring the
  `getRelationships` / `mutateRelationship` shape.
- `apps/web/src/pages/api/spaces/[spaceId]/automations.ts` (GET/POST/PATCH/DELETE) +
  `interfaces.ts` (GET/POST/PATCH/DELETE) — guarded proxies mirroring
  [`relationships.ts`](../../../apps/web/src/pages/api/spaces/[spaceId]/relationships.ts):
  `guardSchemaDocsRequest`, `baseId` / body / action validation, 503 when the engine binding
  or token is unconfigured, `schemaDocsErrorStatus` mapping. Co-located `*.test.ts`.
- [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — mounts the two new tabs
  (radio `tabs`+`tab-content`, matching the existing Browse/Docs pattern) and passes the SSR
  entity index + tier level through.
- New governed components under `apps/web/src/components/schema/`: `SchemaAutomations.astro`,
  `SchemaInterfaces.astro`, and the ported shared `EntitySearch.astro` / `EntityPanel.astro`
  tag-picker + sidebar (if not already present in this repo). **Prerequisite:** a new governed
  `ui/Drawer.astro` primitive (the round-2 default create/edit surface). Each new
  `components/schema/*.astro` and the Drawer primitive must be registered in
  `apps/web/src/components/component-classification.json`, have a sibling `*.stories.ts`, and a
  `/styleguide` entry in `apps/design` (per `apps/web/.claude/CLAUDE.md` §2.5, enforced by
  `pnpm --filter @baseout/web audit:components`) — **no `<style>` blocks** where a daisyUI
  primitive covers it.
- **Pairs with** [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/proposal.md)
  (per-Space storage, inbound API, engine read + manual-create endpoints, tier resolver) +
  [`workflows-automations-interfaces-docs`](../workflows-automations-interfaces-docs/proposal.md)
  (backup-run finalization). Consumes the engine's automations/interfaces read + manual-CRUD
  endpoints through the new proxy routes.
- **Deferred follow-ups:**
  - Reverse tag surfacing on the Browse detail panel (a Table/Field showing the
    Automations/Interfaces that tag it) — keeps the existing Browse tab unchanged in this pass.
  - A structured (non-raw-JSON) `definition` editor — v1 ships raw JSON with format/validate.
  - The Airtable Script / Automation generators (`server-automations-interfaces-docs` Phases
    C/D) — the copy-snippet onboarding path, separate from these listing/edit tabs.
  - The Visualize app-layer graph of automations/interfaces (`visualize-automations-interfaces`).
  - No DB / migration / capability-key change in this change.
