# visualize-tab

A Visualize tab on the Schema page: a React Flow canvas with a Data / Relationships /
Automations & Interfaces mode menu, a hierarchical field-visibility filter, base/type
facets, collapse-fields-under-table, removed-entity muting, and a below-Growth upsell
for the Automations & Interfaces mode.

## ADDED Requirements

### Requirement: Visualize tab with a mode menu
The Schema page SHALL add a **Visualize** tab (after Browse) that renders a React Flow
canvas hosting a mode menu with three modes: **Data** (ER graph), **Relationships**,
and **Automations & Interfaces**. Switching modes SHALL change what the canvas draws
without leaving the tab. The canvas island SHALL hydrate lazily (`client:visible`) so
its bundle loads only when the tab opens. When no schema exists, the tab SHALL show an
empty state.

#### Scenario: Switch modes
- **WHEN** a user opens the Visualize tab and selects a different mode
- **THEN** the canvas redraws in that mode without leaving the tab

#### Scenario: No schema
- **WHEN** the Space has no captured schema
- **THEN** the Visualize tab shows an empty state

### Requirement: Data and Relationships modes reuse existing reads
The **Data** mode SHALL render tables-as-nodes and linked-record edges from the
existing schema data (`getSchema` / the SSR field-visibility schema) with no new
backend. The **Relationships** mode SHALL render from the existing relationships read
(`getRelationships`) with no new backend.

#### Scenario: Data mode draws the ER graph
- **WHEN** a user selects the Data mode
- **THEN** the canvas draws tables as nodes with linked-record edges from the existing schema

#### Scenario: Relationships mode draws the relationship web
- **WHEN** a user selects the Relationships mode
- **THEN** the canvas draws the relationships from the existing relationships read

### Requirement: Automations & Interfaces mode consumes the entity graph
The **Automations & Interfaces** mode SHALL fetch the assembled graph from
`/api/spaces/[spaceId]/entity-graph` and render `automation`/`interface`/`page`/
`table`/`field` nodes with `references`, `reads`, and `triggers` edges, each visually
distinct with a legend. Its empty state SHALL point to where Automations/Interfaces are
captured.

#### Scenario: Render the entity graph
- **WHEN** a user selects Automations & Interfaces on a Space with captured entities
- **THEN** the canvas draws typed nodes and references/reads/triggers edges from the entity-graph payload

#### Scenario: No captured automations or interfaces
- **WHEN** the Space has schema but no submitted Automations or Interfaces
- **THEN** the A&I mode shows an empty state pointing to entity capture

### Requirement: Field-visibility filter and facet filters
The Visualize tab SHALL provide a hierarchical Base ▸ Table ▸ Field visibility filter
(reusing the shared field-visibility model) and a base / node-type facet filter. Hiding
a field SHALL drop its node/row from the canvas; filtering by base or type SHALL narrow
the drawn graph.

#### Scenario: Hide a field
- **WHEN** a user hides a field in the field-visibility filter
- **THEN** that field is dropped from the canvas

#### Scenario: Filter by base
- **WHEN** a user selects a subset of bases in the facet filter
- **THEN** the canvas draws only the selected bases' entities

### Requirement: Collapse fields under table and mute removed entities
Field nodes SHALL collapse under their Table by default with an expand toggle. Removed
(soft-deleted) entities SHALL render muted with a "Removed from Airtable" treatment,
revealed by an "include removed" toggle, across all modes.

#### Scenario: Expand fields
- **WHEN** a user toggles expand-fields
- **THEN** field nodes appear under their tables

#### Scenario: Reveal removed entities
- **WHEN** a user enables include-removed
- **THEN** soft-deleted entities appear muted with a "Removed from Airtable" treatment

### Requirement: Tier gating and below-Growth upsell
The Visualize tab SHALL be Launch+ gated via the existing Schema Docs tier guard on its
proxy (no new capability key). The **Automations & Interfaces** mode SHALL show a
below-Growth upsell to organizations that lack that entitlement instead of the graph.

#### Scenario: Below-Growth organization opens Automations & Interfaces
- **WHEN** an organization below Growth selects the Automations & Interfaces mode
- **THEN** the mode shows the upgrade upsell instead of the graph

#### Scenario: Entitled organization opens Automations & Interfaces
- **WHEN** an entitled organization selects the Automations & Interfaces mode
- **THEN** the entity graph renders

### Requirement: Governance for new schema components
New React islands (`SchemaCanvas.tsx`, `FieldsFilter.tsx`) SHALL satisfy the islands
governance guard (islands are `.tsx` only). Any new `components/schema/*.astro`
(`FacetFilter.astro`) SHALL be registered in the component classification, carry a
sibling `*.stories.ts`, have a `/styleguide` entry, and contain no `<style>` block. The
existing five vanilla Schema tabs SHALL NOT be rewritten by this change.

#### Scenario: FacetFilter is catalogued
- **WHEN** `FacetFilter.astro` is added under `components/schema/`
- **THEN** it is registered in the classification with a matching story and styleguide entry, and the component audit passes

#### Scenario: Existing tabs untouched
- **WHEN** the Visualize tab is added
- **THEN** the Browse/Relationships/Health/Docs/Chat tabs are left as-is
