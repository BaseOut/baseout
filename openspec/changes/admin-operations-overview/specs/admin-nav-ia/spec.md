## ADDED Requirements

### Requirement: Grouped sidebar navigation

The admin sidebar (`SidebarLayout.astro`) SHALL replace the flat item list with labeled groups in this order: **Operations** (Dashboard `/`, Backups `/backups`, Restores `/restores`, Errors `/errors`, Services `/services`), **Directory** (Customers `/customers`, Users `/users`, Spaces `/spaces`, Connections `/connections`, Databases `/databases`), **Billing** (Subscriptions `/subscriptions`, Migration `/migration`), **System** (Audit `/audit`). A nav entry SHALL appear only when its route exists in the app, so entries owned by sibling changes (`/errors`, `/users`, `/spaces`, and `/customers` when owned by `admin-entity-directories`) surface as those changes land. Group labels SHALL render as non-interactive section headers, including in the collapsed-sidebar state.

#### Scenario: Groups render with existing routes only

- **WHEN** the sidebar renders in a build where `/errors` and `/users` do not yet exist
- **THEN** the four group headers render with their existing routes, and no nav entry points at a non-existent route

#### Scenario: Active state within groups

- **WHEN** the current path is `/backups/abc123`
- **THEN** the Backups entry in the Operations group is marked active (existing prefix-match rule: exact for `/`, `startsWith` otherwise)

### Requirement: Organizations tracker relocates to /customers

The Organizations → Spaces tracker currently served at `/` SHALL be served at `/customers`. If change `admin-entity-directories` has landed, `/customers` is its directory page and this change SHALL NOT duplicate it; otherwise this change SHALL move the existing tracker page to `/customers` unchanged as a stopgap. The nav entry label SHALL be "Customers". `/` SHALL serve the operational dashboard (see `admin-operations-dashboard`).

#### Scenario: Tracker reachable at /customers

- **WHEN** a staff user opens `/customers`
- **THEN** the Organizations → Spaces listing renders (directory version if `admin-entity-directories` landed; relocated tracker otherwise) with its existing `?q=` search behavior

#### Scenario: Home no longer lists Organizations

- **WHEN** a staff user opens `/`
- **THEN** the operational dashboard renders and the Organizations listing is not present, with the dashboard linking to `/customers` for the directory
