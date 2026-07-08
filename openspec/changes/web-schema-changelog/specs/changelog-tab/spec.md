# changelog-tab

A Changelog tab on the Schema page rendering the engine's per-Space schema
changelog feed as a day-grouped, base ▸ [concept-icon] entity feed of change
events, with filters and Launch+ gating.

## ADDED Requirements

### Requirement: Day-grouped changelog feed of base ▸ entity events

The Schema page SHALL add a **Changelog** tab (a `views/schema/ChangelogTab.astro`
replacing the SoonTab placeholder in the round-3 shell) that renders the engine
feed ([`server-schema-changelog`](../../../server-schema-changelog/)) as a
day-grouped list of entries, each shown as a **base ▸ [concept-icon] entity** row
with a typed badge derived client-side from the entry's `kind` + `changeType`
(added / removed / renamed / type changed / config), client-rendered wording
(entity names and breadcrumbs resolved from the SSR entity index — the engine
payload carries identifiers, not display names), and an optional before → after
delta. The tab SHALL lazy-load on first open and refetch on base/filter change.
When the Space has no captured schema, the tab SHALL show an empty state.
Existing Schema-page tabs SHALL remain unchanged.

#### Scenario: Feed renders with typed entries

- **WHEN** a user opens the Changelog tab for a Space with change entries
- **THEN** entries appear grouped by day, each as a base ▸ [concept-icon] entity row with a typed badge and readable wording

#### Scenario: Before → after delta on rename/retype

- **WHEN** an event is a rename or a type change
- **THEN** its row shows the before → after values from the engine event

### Requirement: Breaks-data warning surfaced

An entry whose engine payload carries `breaksData: true` SHALL render a ⚠️
affordance making it unmissable (the highest-value signal in the feed).

#### Scenario: Type change that may break data

- **WHEN** a field type change entry carries `breaksData: true`
- **THEN** its row shows a ⚠️ warning line

### Requirement: Filters — base, event kind, include-removed, search

The tab SHALL offer a base picker (forwarding `baseId` to the proxy — required by
the engine route), an event-kind filter, and an **include-removed** toggle, plus a
client-side search over the last-fetched entries. Kind and include-removed
filtering MAY be applied client-side until the engine's `kinds` / `includeRemoved`
params land ([`server-schema-changelog`](../../../server-schema-changelog/)
tasks §5), after which the tab SHALL forward them. When filters exclude every
entry, the tab SHALL show a no-match state.

#### Scenario: Include removed

- **WHEN** the user disables include-removed
- **THEN** `removed` entries disappear from the feed (client-side, or via `includeRemoved=false` once the engine param lands)

#### Scenario: Filters exclude everything

- **WHEN** the active filters/search match no entries
- **THEN** the tab shows a "no changes match these filters" state with a clear-filters affordance

### Requirement: Empty states and tier gating

The tab SHALL render the engine's empty-state contract — a single-run Space shows
"changes appear after your second backup", and a backed-up Space with no changes
shows "no changes since your first backup". The proxy SHALL enforce auth,
ownership, and the Schema Docs tier guard; a non-entitled org SHALL receive 403 and
the tab SHALL show an upgrade affordance.

#### Scenario: Single-run Space

- **WHEN** the Space has only one backup run (nothing to diff)
- **THEN** the tab shows the "second backup" empty state, not an error

#### Scenario: Non-entitled organization

- **WHEN** an org without Schema Docs entitlement opens the tab
- **THEN** the proxy returns 403 and the tab shows the upgrade message

### Requirement: Component governance

The Changelog surface SHALL satisfy the two-tier UI governance (§4.2): either a
promoted `components/schema/SchemaChangelog.astro` registered in
`component-classification.json`, with a `*.stories.ts` and an `apps/design`
`/styleguide` entry and no `<style>` block (daisyUI classes only), OR the feed
composed vanilla-in-view with daisyUI markup and documented in the `/styleguide`
(the ungoverned component not added). Either path SHALL pass `audit:components`.

#### Scenario: Audit passes

- **WHEN** the component-governance audit runs
- **THEN** the Changelog surface is classified/storied/styleguide-documented (promoted) or composed vanilla-in-view, and `audit:components` is green
