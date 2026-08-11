# usage-visibility

Usage and limits as data endpoints feeding the dashboard's utilization placeholders.

## ADDED Requirements

### Requirement: Usage/limits endpoints per Space and per Organization

`apps/web` SHALL expose authenticated, org-scoped endpoints returning, for every meterable feature: the effective limit (post-override, post-add-on), current usage, percent used, notification state, and period boundaries for flow meters — at Organization scope and per-Space scope (for meters with Space attribution). Responses SHALL come from the shared resolution function and `usage_rollups`, never from recomputation in the route.

#### Scenario: Space utilization payload

- **WHEN** the Space dashboard requests utilization for one Space
- **THEN** it receives that Space's records, file GB, and database GB usage with the org-level effective limits and percentages in one response

#### Scenario: Org-wide utilization payload

- **WHEN** the settings/usage view requests Organization utilization
- **THEN** it receives every meterable feature with limit, used, percent, state, and (for flow meters) the reset date

### Requirement: Dashboard placeholders wire to real data

The existing Space-dashboard utilization placeholders SHALL render from the endpoints above (loading and error states per house standards). Visual/UX redesign of utilization views is owned by the paired ui-only change; this requirement covers wiring the current placeholders to live data only.

#### Scenario: Placeholder becomes live

- **WHEN** a Space with reported usage renders its dashboard
- **THEN** the utilization area shows live percentages from the endpoint instead of placeholder values

### Requirement: Settings Usage page

`apps/web` settings SHALL include a Usage page showing (a) overall account usage — every meterable feature with effective limit, current usage, percentage, warning state, and reset date for flow meters — and (b) a per-Space breakdown of the Space-attributed meters (records, file storage, database size, bases) with the same stats per Space. Data comes from the usage/limits endpoints; visual design is owned by the paired ui-only change (`usage-and-billing`).

#### Scenario: Account and Space views in one place

- **WHEN** an Organization owner opens Settings → Usage
- **THEN** they see the org-wide utilization of every meter and can see each Space's contribution to the Space-attributed meters

### Requirement: Warning states are visible where usage is shown

Wherever utilization renders, features in `warned_90`/`warned_100`/`enforced` state SHALL be visually flagged with the same percentages the notification system used (one source of truth for "how close am I").

#### Scenario: Near-limit meter is flagged

- **WHEN** an Organization is at 94% of records
- **THEN** the records utilization renders in a warning treatment consistent with the notification the org received
