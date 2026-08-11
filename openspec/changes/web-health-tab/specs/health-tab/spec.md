# health-tab

A read-only Health view on the Schema page surfacing the engine-computed per-base
grade, per-metric breakdown, and issues.

## ADDED Requirements

### Requirement: Health tab on the Schema page
The Schema page SHALL present a **Health** tab (in the target tab order, between
Changelog and Docs) whenever the Space has captured schema. When no schema exists,
the tab SHALL show an empty state directing the user to run a backup.

#### Scenario: Health tab visible with schema
- **WHEN** a user opens `/schema` for a Space that has captured schema
- **THEN** a "Health" tab is available alongside Browse and Docs

#### Scenario: No schema captured
- **WHEN** the Space has no captured schema
- **THEN** the Health tab shows an empty state ("Health scores appear once a backup has captured this Space’s schema")

### Requirement: Per-base grade, breakdown, and issues
For a selected base, the Health tab SHALL display the base **grade** (0–100 score
+ band, colored by score), a **per-metric breakdown** (metric name, severity,
scope, weight, sub-score), and an **issues** list. Each issue with an Airtable
deep-link SHALL render an "Open in Airtable" link. When a base has no grade and no
metrics, the tab SHALL show a "not scored yet" message.

#### Scenario: Base with health results
- **WHEN** the selected base has a computed grade and metrics
- **THEN** the grade card, metric breakdown table, and issues list render for that base

#### Scenario: Base not yet scored
- **WHEN** the selected base has no grade and no metric sub-scores
- **THEN** the tab shows a "this base has not been scored yet" message

#### Scenario: Multiple bases
- **WHEN** the Space has more than one scored base
- **THEN** a base picker lets the user switch bases, refetching that base's overview

### Requirement: Lazy-loaded from the engine read route
The Health tab SHALL fetch a base's overview from
`GET /api/spaces/:spaceId/health-overview?baseId=...` (proxying the engine
`health-overview` route) only when the tab is first opened, and refetch on base
change — not on initial page load.

#### Scenario: Fetch deferred until first open
- **WHEN** a user loads `/schema` but does not open the Health tab
- **THEN** no `health-overview` request is made

#### Scenario: Fetch on first open
- **WHEN** the user opens the Health tab for the first time
- **THEN** the overview for the selected base is fetched and rendered

### Requirement: Launch+ gating
The Health overview proxy route SHALL enforce authentication, ownership (IDOR),
and the Schema Docs tier guard. A request from a non-entitled organization SHALL
receive 403, and the tab SHALL render an upgrade affordance rather than an error.

#### Scenario: Non-entitled organization
- **WHEN** an organization without Schema Docs entitlement opens the Health tab
- **THEN** the proxy returns 403 and the tab shows "Health scoring is available on the Launch plan and above."

#### Scenario: Cross-organization access blocked
- **WHEN** a user requests a `spaceId` they do not own
- **THEN** the proxy denies the request (no health data leaked)
