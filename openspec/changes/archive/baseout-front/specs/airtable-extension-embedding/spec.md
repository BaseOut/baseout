## ADDED Requirements

### Requirement: Embedded-context detection

Front SHALL detect embedded context via a URL parameter AND the check `window.parent !== window`. Only when both signals match SHALL the app render the embedded layout.

#### Scenario: Plain dashboard load

- **WHEN** a standard logged-in user opens /dashboard
- **THEN** `window.parent === window` and the standard layout renders

#### Scenario: Embedded load

- **WHEN** the URL contains the embedded marker AND `window.parent !== window`
- **THEN** the compact embedded layout renders

### Requirement: window.postMessage framework

Front SHALL implement a `window.postMessage` handler that exchanges context (current base, table, view) with a thin wrapper running inside the Airtable extension. The messaging contract SHALL be documented and stable.

#### Scenario: Wrapper sends context

- **WHEN** the wrapper posts `{ type: 'context', baseId, tableId, viewId }`
- **THEN** front updates the active selection in the embedded layout

### Requirement: Compact embedded layout

The embedded layout SHALL be context-aware (single-base focus, smaller sidebar) and distinct from the standalone dashboard.

#### Scenario: Sidebar collapsed

- **WHEN** the embedded layout renders
- **THEN** the sidebar is collapsed by default and only shows the active base's surfaces

### Requirement: First-use auth popup

The embedded context SHALL still require a logged-in Baseout user. On first use, the wrapper SHALL open a popup for the auth flow without breaking the iframe.

#### Scenario: Unauth'd embedded load

- **WHEN** an unauthenticated user lands in the embedded context
- **THEN** a popup is opened for sign-in; once auth completes, the embedded view restores
