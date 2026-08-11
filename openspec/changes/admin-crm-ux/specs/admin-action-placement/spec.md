# admin-action-placement

Listings are read-only; every manual admin action lives on a detail (drill-down) page.

## ADDED Requirements

### Requirement: Listing pages render no mutation controls

Admin listing pages (directories, run viewers, health/status tables, the operations dashboard) SHALL render no mutation controls — no action buttons, no forms that POST to action endpoints. Mutation controls SHALL appear only on the detail page of the entity they act on (or on the owning Organization's command center where the action is org-scoped). Relocating a control SHALL NOT change the underlying action endpoint, its confirmation flow, rate limits, or audit writes.

#### Scenario: Connections listing is read-only

- **WHEN** a staff member views the `/connections` listing
- **THEN** no invalidate (or other mutation) button is rendered; acting on a connection requires opening that connection's detail page

#### Scenario: Action machinery is unchanged

- **WHEN** a staff member triggers a relocated action from a detail page
- **THEN** the same API route is called with the same confirmation step and the same audit row is written as before the relocation

### Requirement: Every existing action has a detail-page home

Each existing manual admin action SHALL be reachable from a detail page: force backup on the Space detail page and the owning Organization's command center; invalidate connection on the connection detail page; force migration completion on the Organization command center; error acknowledge/unacknowledge on the error detail page. An action SHALL never be removed from a listing before its detail-page placement exists (no release window where an action is unreachable).

#### Scenario: Force backup from the Space

- **WHEN** a staff member opens `/spaces/[id]` for an active Space
- **THEN** a force-backup control is available there, with the existing confirmation flow

#### Scenario: No homeless actions

- **WHEN** the listing-page action controls are removed in a release
- **THEN** every one of those actions is already available on its designated detail page in the same release

### Requirement: Connection detail page

`/connections/[id]` SHALL exist as a staff-gated, master-DB-only detail page showing the connection's identity and platform, status and health classification, owning Organization (linked to its command center), Spaces served (linked), status-change history from the connection status audit, and a session summary — plus the invalidate-connection action. It SHALL expose metadata only: no token values and no `*_enc`-derived data.

#### Scenario: Drill into a connection

- **WHEN** a staff member clicks a connection row on `/connections`
- **THEN** they land on `/connections/[id]` with the details above, and can navigate to the owning Organization or invalidate the connection from there

### Requirement: Error detail page

`/errors/[id]` SHALL exist as a staff-gated detail page giving each triaged error a stable URL, showing the full error message and context, the associated run, Space, and owning Organization (all linked), acknowledgement state and history, and the acknowledge/unacknowledge action.

#### Scenario: Drill into an error

- **WHEN** a staff member clicks an error row on `/errors`
- **THEN** they land on `/errors/[id]`, see the full error context with links to the run and owning Organization, and can acknowledge it there
