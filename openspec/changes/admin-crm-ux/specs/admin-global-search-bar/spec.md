# admin-global-search-bar

Persistent Stripe-style global search in the admin top bar.

## ADDED Requirements

### Requirement: Persistent top-bar search on every page

The admin chrome SHALL render a persistent top bar on every page containing the global search input (replacing the sidebar search box). Submitting the input SHALL perform a plain GET to the existing `/search` results page, preserving its query-shape detection, grouped results, and single-exact-match redirect behavior unchanged. A keyboard shortcut (Cmd/Ctrl+K, and `/` when no input is focused) SHALL focus the search input.

#### Scenario: Search from anywhere

- **WHEN** a staff member on any admin page presses Cmd+K, types a customer email, and presses Enter
- **THEN** the browser navigates to the search results — redirecting straight to the matching user's page when the email is an exact unique match

#### Scenario: No-JS fallback

- **WHEN** JavaScript is disabled
- **THEN** the top-bar input still submits via GET to `/search` and full results render there

### Requirement: Typeahead quick results

With JavaScript available, typing in the top-bar search SHALL show a debounced dropdown of quick results grouped by entity type (Organizations, Users, Spaces, Bases, Connections, Backup runs, Restore runs), each row showing a label plus disambiguating context and navigating directly to that entity's page on selection. The dropdown SHALL be keyboard-navigable (arrow keys + Enter, Escape closes); Enter with no selection SHALL submit the full search. Quick results SHALL be served by a staff-gated suggest endpoint that reuses the existing search lookup logic with tight per-type limits and returns entity metadata only (id, label, context, href) — never token values, `*_enc`-derived data, or record content.

#### Scenario: Jump directly from the dropdown

- **WHEN** a staff member types part of an organization's name and picks the dropdown row with arrow keys and Enter
- **THEN** the browser navigates directly to that Organization's command center without visiting the results page

#### Scenario: Suggest endpoint is staff-gated

- **WHEN** an unauthenticated request hits the suggest endpoint
- **THEN** the existing admin middleware rejects it exactly as it does any other admin route
