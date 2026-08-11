## ADDED Requirements

### Requirement: Universal entity-linking convention

Every admin page that renders a reference to an Organization, Space, user, connection, backup run, or restore run SHALL render it as a hyperlink to that entity's canonical admin page (`/organizations/[id]`, `/spaces/[id]`, `/users/[id]`, `/connections` anchored/filtered to the connection, `/backups/[id]`, `/restores` filtered to the run). Bare entity UUIDs or plain-text entity names with no link are non-compliant. Link targets SHALL come from a single shared helper (`entityHref(type, id)`) so routes change in one place. This convention applies to all future admin surfaces, not only the pages retrofitted by this change.

#### Scenario: No dead-end references

- **WHEN** any existing admin surface (`/`, `/backups`, `/backups/[id]`, `/restores`, `/connections`, `/databases`, `/subscriptions`, `/migration`, `/audit`, `/organizations/[id]`) renders after this change
- **THEN** every Organization, Space, user, connection, and run reference on the page is a hyperlink produced by the shared helper

#### Scenario: New surface inherits the convention

- **WHEN** a later change adds an admin page that displays a Space name
- **THEN** the spec-level convention requires it to link via the shared helper, and review flags plain-text references as violations

### Requirement: Peek sidebar

The admin app SHALL provide a reusable peek sidebar: activating a peek affordance on an entity link opens a right-hand panel summarizing that entity (headline identity fields, a small set of key stats, and health/status badges) with an "Open full page" link to the canonical detail page, without navigating away from the current page. Summaries SHALL be served by staff-gated endpoints under `/api/peek/<type>/<id>` returning metadata only. At minimum, Organization, Space, user, connection, and backup-run peeks SHALL be supported.

#### Scenario: Peek an Organization from the backups list

- **WHEN** staff activates the peek affordance on an Organization reference in a `/backups` row
- **THEN** a sidebar opens showing the Org's name, slug, subscription status/tier, Space count, and member count, plus an "Open full page" link to `/organizations/[id]`, while the backups list stays in place

#### Scenario: Progressive enhancement

- **WHEN** JavaScript is unavailable or the peek island has not hydrated
- **THEN** entity links still navigate normally to the full detail page and no functionality is lost

#### Scenario: Peek endpoint is gated

- **WHEN** a request without a valid staff session calls `/api/peek/space/<id>`
- **THEN** the middleware rejects it exactly like any other admin route (401/403 JSON), and no entity data is returned
