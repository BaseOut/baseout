## ADDED Requirements

### Requirement: The Schema page presents eight tabs in four labelled clusters
The Schema page SHALL group its tabs into four labelled clusters — Explore (Browse ·
Visualize · Relationships), App layer (Automations · Interfaces), Monitor (Changelog ·
Health), Knowledge (Docs · Chat History) — with a quiet uppercase label above each
cluster, thin dividers between clusters, and one shared baseline. A page-level
freshness stamp ("Schema as of …") and a persistent "Ask about your schema" ghost
button sit in the header, outside any tab.

#### Scenario: Switching tabs
- **WHEN** the user clicks a tab in any cluster
- **THEN** that tab shows the primary-underline active state, its panel becomes visible, and every other panel hides — without a page load

#### Scenario: The chat launcher
- **WHEN** the user clicks "Ask about your schema" from any tab
- **THEN** the Chat panel opens (the same surface as Knowledge ▸ Chat History)

### Requirement: Tabs whose backend has not shipped present a soon state
Visualize, Changelog, Automations, and Interfaces SHALL render a clearly-marked
coming-soon state (never an error or a blank panel) until their backing slices land,
using the section's icon and a one-line description of what will appear.

#### Scenario: Opening a gated tab
- **WHEN** the user opens Visualize before the entity-graph slice ships
- **THEN** the panel shows the Visualize icon, names the capability, and says it is coming soon — no fixture data, no error

### Requirement: The Browse detail panel follows the canonical anatomy
The Browse entity detail SHALL render: identity (name · kind · type), a removed notice
(soft warning alert with the deleted date) when the entity no longer exists in
Airtable, present-only description sections (Airtable / AI / internal), the field's
configuration (formula, lookup/rollup anchoring, select choices, link target), and
reverse references — fields that point at this field, plus grouped "Referenced by"
(Formulas · Rollups · Lookups · Docs) with per-group counts — derived by inverting the
captured forward graph. Sections that are absent are omitted entirely.

#### Scenario: A removed field
- **WHEN** the user opens a field that was deleted in Airtable
- **THEN** the panel leads with `alert alert-soft alert-warning` naming the deletion date and that the last backup is shown

#### Scenario: A field referenced by a formula
- **WHEN** the user opens a field that another field's formula references
- **THEN** the panel's Referenced-by section lists that formula field under the Formulas group with a "← referenced by" direction marker
