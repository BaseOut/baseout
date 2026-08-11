# automations-interfaces-tabs

Two tabs on the Schema page — **Automations** and **Interfaces** — that list a Space's
manually-captured Automations and Interfaces (Airtable's REST API can't export them), and let
users create, edit, and soft-delete them by hand with a Table/Field tag-picker. Reads and writes
go through guarded web proxy routes over the engine's automations/interfaces endpoints
(`server-automations-interfaces-docs`).

## ADDED Requirements

### Requirement: Automations tab grouped by Base
The Schema page SHALL add an **Automations** tab that, for the selected Space, lists captured
automations grouped by **Base** (collapsible sections), each row showing name, trigger type, a
status badge (`active` / `removed`), and a count of tagged Tables/Fields. When no schema exists,
the tab SHALL show an empty state. The tab SHALL lazy-load on first open and refetch on Base
filter or include-removed change.

#### Scenario: Grouped automations render
- **WHEN** a user opens the Automations tab for a Space with captured automations
- **THEN** automations appear grouped by Base, each row showing name, trigger type, status badge, and tag count

#### Scenario: No schema
- **WHEN** the Space has no captured schema
- **THEN** the tab shows an empty state

#### Scenario: Base filter
- **WHEN** the user selects a Base in the filter
- **THEN** only that Base's automations are listed

### Requirement: Interfaces tab with nested Pages
The Schema page SHALL add an **Interfaces** tab that lists captured Interfaces with their child
**Pages** nested one level under each Interface. Each row SHALL show name, `type`
(`interface` / `page`), status badge, and tag count. A Page whose parent Interface is missing
SHALL still be listed (as an orphan). The tab SHALL lazy-load and refetch like the Automations tab.

#### Scenario: Pages nest under their Interface
- **WHEN** a user opens the Interfaces tab
- **THEN** each Interface lists its Pages nested beneath it

#### Scenario: Orphan page
- **WHEN** a Page's parent Interface is absent
- **THEN** the Page still appears in the list (surfaced as an orphan), not silently dropped

### Requirement: Create and edit in a right Drawer
Each tab SHALL open a right **Drawer** for create/edit. The **Automations** Drawer SHALL require
an Automation ID and Name, accept an optional trigger type and a raw `definition` JSON field, and
validate the `definition` as JSON before submit. The **Interfaces** Drawer SHALL require an
Interface/Page ID and a `type` (`interface | page`); when `type = page` it SHALL require a
**parent-interface picker**. The Drawer SHALL be a governed `ui/Drawer.astro` primitive. Every
save SHALL show a spinner via `setButtonLoading`.

#### Scenario: Create an automation
- **WHEN** a user fills the Automations Drawer with an ID + Name and saves
- **THEN** the automation is created via the proxy and the list refetches to include it

#### Scenario: Page requires a parent interface
- **WHEN** a user sets `type = page` in the Interfaces Drawer
- **THEN** the parent-interface picker becomes required and save is blocked until a parent is chosen

#### Scenario: Invalid definition JSON
- **WHEN** the raw `definition` field is not valid JSON
- **THEN** client-side validation flags it and the save is blocked

### Requirement: Table/Field tag-picker, clickable and bidirectional
The create/edit Drawer SHALL include a Table/Field **tag-picker** reusing the shared
`EntitySearch`, scoped to the entity's Base. An entity's tagged Tables/Fields SHALL render as
clickable badges, with `auto` (engine-derived) and `manual` (user-added) tags styled distinctly;
only `manual` tags SHALL be removable from the UI. A tag whose target entity was removed SHALL
show a warning badge rather than being silently dropped.

#### Scenario: Add a manual tag
- **WHEN** a user picks a Table or Field in the tag-picker and saves
- **THEN** it appears as a clickable `manual` badge on the entity

#### Scenario: Removed tag target
- **WHEN** a tagged Table or Field has been removed from Airtable
- **THEN** its badge shows a warning state instead of disappearing

#### Scenario: Only manual tags are removable
- **WHEN** a user views an entity's tags
- **THEN** `manual` tags offer a remove affordance and `auto` tags do not

### Requirement: Soft-delete rendering and include-removed toggle
Delete SHALL be **soft**: a deleted automation/interface SHALL render muted with a
"removed from Airtable" badge rather than vanishing, and SHALL be hidden by default behind an
**include-removed** toggle. Enabling the toggle SHALL reveal soft-deleted rows.

#### Scenario: Soft-delete an automation
- **WHEN** a user deletes an automation
- **THEN** the row is muted with a "removed from Airtable" badge and is hidden unless include-removed is on

#### Scenario: Reveal removed
- **WHEN** the user enables include-removed
- **THEN** soft-deleted automations and interfaces appear (muted)

### Requirement: Guarded proxy routes with server-side validation
Reads and writes SHALL go through web proxy routes `/api/spaces/[spaceId]/automations` and
`/api/spaces/[spaceId]/interfaces` supporting GET / POST / PATCH / DELETE. Each route SHALL
enforce auth, ownership (IDOR), and the Schema Docs (Growth+) tier guard via
`guardSchemaDocsRequest`, validate the body/action server-side, apply better-auth CSRF on
mutating verbs, and return 503 when the engine binding or token is unconfigured.

#### Scenario: Unauthenticated request
- **WHEN** an unauthenticated request hits the automations or interfaces proxy
- **THEN** it is rejected before reaching the engine

#### Scenario: Cross-tenant access
- **WHEN** a user requests a Space they do not own
- **THEN** the proxy returns an ownership (IDOR) error and does not proxy to the engine

#### Scenario: Engine unconfigured
- **WHEN** the backup-engine binding or internal token is not configured
- **THEN** the proxy returns 503

#### Scenario: Invalid mutating body
- **WHEN** a POST/PATCH omits a required field (e.g. an automation with no ID, or a page with no parentId)
- **THEN** the proxy returns 400 and does not write

### Requirement: Below-Growth upsell and tier gating
An organization without the Schema Docs (Growth+) entitlement SHALL receive 403 from the proxy,
and each tab SHALL render an upsell empty state with an upgrade affordance instead of the
listing/form.

#### Scenario: Non-entitled organization
- **WHEN** an org below Growth opens the Automations or Interfaces tab
- **THEN** the proxy returns 403 and the tab shows the upsell empty state

#### Scenario: Entitled organization
- **WHEN** a Growth+ org opens the tabs
- **THEN** the listing and create/edit Drawer are available
