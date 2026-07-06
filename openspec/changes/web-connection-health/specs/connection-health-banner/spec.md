# connection-health-banner

An app-wide, severity-graded connection-health signal: a dismissible/collapsible
banner at the top of the work area plus a compact topbar pill, wired to the
existing Connection + storage-destination status, with a reconnect affordance
that routes to the existing reconnect flow.

## ADDED Requirements

### Requirement: App-wide connection-health banner
The app shell SHALL render a **ConnectionHealthBanner** at the top of the work
area (under the topbar, above content) whenever the active Space's computed
connection health is not `healthy`. When health is `healthy` — every Connection
and storage destination is active — the shell SHALL render no banner. The banner
props SHALL be derived from state already hydrated into `$integrations`
(`connections[].status`, `storageDestinations[]`) — no new backend, engine, DB,
or capability-key surface.

#### Scenario: Healthy Space renders nothing
- **WHEN** every Connection and storage destination for the active Space is active
- **THEN** no connection-health banner or pill is rendered and the shell stays clean

#### Scenario: Banner surfaces on every page
- **WHEN** a Space's computed connection health is not `healthy`
- **THEN** the banner appears at the top of the work area on every page of the app

### Requirement: Severity-graded states mapped to the real status vocabulary
The banner SHALL grade by severity, mapping the real Connection status vocabulary
onto banner states: an `invalid` Connection or storage destination → **red**
(`broken`, backups paused); a `pending_reauth` Connection → **amber**
(reconnect-required); a `refreshing` Connection → an info **reconnecting** state;
and a transient success **restored** state. Colour SHALL follow severity (daisyUI
soft `alert-error` / `alert-warning` / `alert-info` / `alert-success`).

#### Scenario: Disconnected Connection is red
- **WHEN** a Connection or storage destination is `invalid`
- **THEN** the banner renders red (`broken`), stating backups are paused, with a Reconnect action

#### Scenario: Reconnect-required Connection is amber
- **WHEN** a Connection is `pending_reauth`
- **THEN** the banner renders amber (reconnect-required) with a Reconnect action

#### Scenario: Refreshing Connection shows a spinner
- **WHEN** a Connection is `refreshing`
- **THEN** the banner renders the info `reconnecting` state with a spinning icon and no Reconnect action

### Requirement: Grouped roll-up for multiple broken connections
When two or more Connections / storage destinations are broken at once, the banner
SHALL render a single grouped roll-up naming the affected connections and a count,
rather than stacking one banner per broken connection.

#### Scenario: Two or more broken connections
- **WHEN** 2+ Connections / destinations are broken for the active Space
- **THEN** a single grouped banner names them with a count and a "Review connections" action

### Requirement: Reconnect affordance routes to the existing flow
The banner's and pill's reconnect affordance SHALL route to the existing reconnect
entry point for the affected provider (the Sources / Destinations reconnect flow
already wired in `apps/web`). The change SHALL add no new route and no new OAuth
surface.

#### Scenario: Reconnect from the banner
- **WHEN** a user clicks Reconnect on the banner
- **THEN** they are routed to the existing reconnect flow for the affected provider

### Requirement: Dismiss, and collapse to a topbar pill
Warning and success states SHALL be dismissible via an ×. The hard-broken state
SHALL be collapsible: a chevron tucks the full-width bar into a compact
**ConnectionHealthPill** in the topbar (next to the notification bell), and the
pill expands the bar back. Collapse ⇄ expand SHALL be matched by a shared `group`
identifier, with no page reload.

#### Scenario: Collapse a broken banner to the pill
- **WHEN** a user clicks the chevron on a broken banner
- **THEN** the full-width bar hides and the topbar pill for the same group appears

#### Scenario: Expand the pill back to the banner
- **WHEN** a user clicks the topbar pill
- **THEN** the full-width bar reappears and the pill hides

#### Scenario: Dismiss a warning banner
- **WHEN** a user clicks × on an amber (warning) or success banner
- **THEN** the banner is removed from the shell

### Requirement: Governed patterns, no scoped styles
Both **ConnectionHealthBanner** and **ConnectionHealthPill** SHALL live under
`apps/web/src/components/patterns/`, be registered in
`component-classification.json` as `storybook-pattern`, each carry a sibling
`*.stories.ts`, and link to a `pattern-connection-health` `/styleguide` entry per
`apps/web/.claude/CLAUDE.md` §2.5. Neither SHALL carry a `<style>` block — styling
comes from daisyUI `alert` + `@opensided/theme` + the `Button` primitive only.

#### Scenario: Governance audit passes
- **WHEN** `pnpm --filter @baseout/web audit:components` runs
- **THEN** both patterns have a classification entry, a sibling story, and no raw-markup violation, and the audit passes
