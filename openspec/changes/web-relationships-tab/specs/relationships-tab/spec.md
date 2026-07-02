# relationships-tab

A Relationships tab on the Schema page listing a base's relationships grouped by
type, with synced-view confirm/dismiss.

## ADDED Requirements

### Requirement: Relationships tab grouped by type
The Schema page SHALL add a **Relationships** tab (after Browse) that, for a
selected base, lists API-derived relationships grouped by type (linked records,
formulas, rollups, lookups, lastModified) plus a synced-views section, each group
showing a count. When no schema exists, the tab SHALL show an empty state. The tab
SHALL lazy-load on first open and refetch on base change.

#### Scenario: Grouped relationships render
- **WHEN** a user opens the Relationships tab for a base with relationships
- **THEN** relationships appear grouped by type with counts, plus any synced views

#### Scenario: No schema
- **WHEN** the Space has no captured schema
- **THEN** the tab shows an empty state

### Requirement: Row badges for validity and history
Each relationship row SHALL show its label and badges for **invalid** (no active
links) and **has-removed** (anchor or a ref removed). Synced views SHALL show
**inferred**, **confirmed**, or **manual** status.

#### Scenario: Invalid relationship
- **WHEN** a relationship has no active links
- **THEN** its row shows an "invalid" badge (and is hidden unless include-removed is on)

### Requirement: Confirm / dismiss inferred synced views
Inferred synced-view rows SHALL offer **Confirm** and **Dismiss** actions that POST
to the engine and refresh the list. API-derived relationships SHALL offer no
actions.

#### Scenario: Confirm an inferred synced view
- **WHEN** a user clicks Confirm on an inferred synced view
- **THEN** it is confirmed and re-rendered without the inferred actions

#### Scenario: Dismiss an inferred synced view
- **WHEN** a user clicks Dismiss
- **THEN** it is removed from the default list

### Requirement: Include removed / dismissed, and tier gating
An "include removed / dismissed" toggle SHALL reveal invalid derived relationships
and (via `includeDismissed`) dismissed candidates. The proxy SHALL enforce auth,
ownership, and the Schema Docs tier guard; a non-entitled org SHALL receive 403 and
the tab SHALL show an upgrade affordance.

#### Scenario: Reveal removed
- **WHEN** the user enables include removed / dismissed
- **THEN** invalid relationships and dismissed candidates appear

#### Scenario: Non-entitled organization
- **WHEN** an org without Schema Docs entitlement opens the tab
- **THEN** the proxy returns 403 and the tab shows the upgrade message
