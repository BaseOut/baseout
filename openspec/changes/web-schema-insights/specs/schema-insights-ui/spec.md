# schema-insights-ui

An Insights section on the Schema page's Health tab surfacing the engine-generated
per-base observations, each tagging the entities it references, with a Pro+ prompt
config, a stale-driven re-run, and an archived toggle.

## ADDED Requirements

### Requirement: Insights section on the Health tab

The Schema page's Health tab SHALL present an **Insights** section (below the grade / breakdown / issues) whenever the Space has captured schema. For a selected base it SHALL list the base's **active** insight observations. When no schema exists, the Health tab SHALL show its empty state. When the base has no insights, the section SHALL show an "insights appear once generated" empty state. The section SHALL lazy-load per base (piggybacking the Health tab's lazy fetch) and refetch on base change.

#### Scenario: Insights render with schema

- **WHEN** a user opens the Health tab for a base that has generated insights
- **THEN** the Insights section lists the base's active observations

#### Scenario: No insights yet

- **WHEN** the selected base has no generated insights
- **THEN** the Insights section shows an empty state directing the user to generate them

#### Scenario: Fetch deferred until first open

- **WHEN** a user loads `/schema` but does not open the Health tab
- **THEN** no insights request is made

### Requirement: Observation cards with clickable entity tags

Each active insight SHALL render as a card showing the observation body, an optional category/evidence, a muted "generated &lt;date&gt;", and a row of **entity-tag chips** for the entities it references (a type icon + the entity name; field chips use the Airtable field-type icon). Each chip SHALL be clickable and SHALL open the **shared entity-detail sidebar** reused from Browse / Docs (not a bespoke one). Engine-supplied strings SHALL be escaped.

#### Scenario: Entity chip opens the shared sidebar

- **WHEN** a user clicks an entity-tag chip on an insight card
- **THEN** the shared entity-detail sidebar opens for that entity (the same component Browse and Docs use)

### Requirement: Archived insights toggle

An "include archived" toggle SHALL reveal archived observations (via `includeArchived`), rendered muted and labeled "archived". The default view SHALL show only `active` insights.

#### Scenario: Reveal archived

- **WHEN** the user enables the include-archived toggle
- **THEN** the section refetches and renders archived observations (muted, labeled) alongside the active ones

#### Scenario: Archived hidden by default

- **WHEN** the Insights section first loads
- **THEN** only active observations are shown

### Requirement: Pro+ prompt config with resolution and reset

For a Pro+ Space, a "Configure insights" affordance SHALL open a prompt editor showing the **effective prompt** and its **source** (Override / Space / System default), and SHALL allow editing the space-level prompt or setting/clearing a per-base override, with **Reset** to default. Below Pro+, the prompt SHALL be read-only with an upgrade affordance.

#### Scenario: Effective prompt and source shown

- **WHEN** a Pro+ user opens the insight prompt config for a base with a per-base override
- **THEN** the editor shows the effective prompt with source "Override" and lets the user edit space or per-base values and Reset to default

#### Scenario: Below Pro+ is read-only

- **WHEN** a user on a Launch-but-not-Pro+ Space opens the prompt config
- **THEN** the prompt is read-only and an upgrade affordance is shown

### Requirement: Last-generated and stale-driven re-run

The Insights section SHALL show the base's last-generated date and, when the base is reported **stale** (effective prompt updated since the last generation), SHALL show a **Re-run** control (Pro+) wired to the engine's on-demand generation; after triggering, it SHALL surface the new active set (polling the read for the async result).

#### Scenario: Stale base offers re-run

- **WHEN** a Pro+ user edits the prompt so the base becomes stale
- **THEN** a Re-run control appears; triggering it regenerates and the new active observations replace the list

### Requirement: Tier gating for reads and mutations

The insights read proxies SHALL enforce authentication, ownership (IDOR), and the Schema Docs (Launch+) tier guard; a non-entitled org SHALL receive 403 and the section SHALL show an upgrade affordance. The prompt-edit and re-run proxies SHALL additionally require Pro+ (`manual_ai`) and return 403 otherwise.

#### Scenario: Non-entitled organization

- **WHEN** an org without Schema Docs entitlement opens the Insights section
- **THEN** the read proxy returns 403 and the section shows the upgrade message

#### Scenario: Launch-but-not-Pro+ mutation blocked

- **WHEN** a Launch-tier (non-Pro+) user attempts a prompt edit or re-run
- **THEN** the mutation proxy returns 403 and the UI shows the upgrade affordance

#### Scenario: Cross-organization access blocked

- **WHEN** a user requests a `spaceId` they do not own
- **THEN** the proxy denies the request (no insights leaked)
