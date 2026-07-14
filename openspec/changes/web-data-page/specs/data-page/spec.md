# data-page

The Data page in apps/web: proxy routes + capability gating over the
`server-data-browse` engine surface, and the ported ui-only Data UI
(Browse · Changelog · Docs · Chat, record detail sidebar, search, exports,
static-snapshot review).

## ADDED Requirements

### Requirement: Data nav item and page

The Space group SHALL gain a **Data** nav item after Schema, route `/data`,
rendering the Data page for entitled tiers and the standard upgrade affordance
below tier.

#### Scenario: Entitled user opens Data
- **WHEN** an entitled user opens `/data` on a dynamic Space
- **THEN** the Browse tab renders with base/table pickers and a paginated record grid

### Requirement: Proxied engine reads with gating

All Data page reads and actions SHALL go through `apps/web` proxy routes under
`/api/spaces/:spaceId/data/*` (middleware-guarded, capability-gated, params
validated server-side) forwarding to the engine's `INTERNAL_TOKEN`-gated
`/api/internal/spaces/:spaceId/data/*` routes via the `BACKUP_ENGINE` service
binding. The web layer SHALL NOT query per-Space data directly.

#### Scenario: Below-tier request
- **WHEN** a below-tier account calls a data proxy route
- **THEN** the proxy returns 403 without contacting the engine

### Requirement: Record browsing and detail

The Browse tab SHALL page records with an opaque cursor ("Load more" — never
offset page numbers), per-field filters by field type, sort, and column
show/hide. Clicking a row SHALL open the shared record detail sidebar with
current field values, per-run history (created/updated/deleted, before → after
diffs), and cell provenance — formula inputs, searchable paginated linked-set
expansion, and lookup sources — expanding one level per interaction.

#### Scenario: Inspect a mutated record
- **WHEN** a user opens a record that changed across backup runs
- **THEN** the sidebar History section lists the runs with per-field before → after values

### Requirement: Changelog and cross-Space search

The Changelog tab SHALL show per-run created/updated/deleted rollups and row
lists, filterable by base/table/field/change-type/run-range. A search mode SHALL
query across all bases/tables in the Space, grouping results base → table, and
SHALL state when results are partial.

#### Scenario: Partial search results
- **WHEN** a search exhausts the engine's scan budget (`partial: true`)
- **THEN** the results header states "showing first matches"

### Requirement: Export from the page

The Browse result set (respecting filters) and Changelog slices SHALL export to
CSV or JSON — small exports download synchronously (streamed through the proxy),
large ones run as async jobs with a notification when ready. Export controls
show a loading state while in flight.

#### Scenario: Large filtered export
- **WHEN** a user exports a scope above the sync threshold
- **THEN** an async job starts and a notification delivers the download when complete

### Requirement: Static-only consent-gated review

On a static-only Space, the page SHALL explain that backups are files and
require explicit per-snapshot consent (dialog naming the snapshot, its
scope/size, and that the ingested copy is temporary) before triggering
static-review ingest. After ingest the user gets per-snapshot browsing, search,
and export; History, Changelog, and Chat render locked "Available with dynamic
backups" states. A purge control deletes the review copy.

#### Scenario: Consent before ingest
- **WHEN** a static-only user opens Data and proceeds without confirming the consent dialog
- **THEN** no ingest starts and no record data is displayed

### Requirement: Data chat gated by AI policy

The Chat tab SHALL remain a locked state until `shared-ai-controls` enforcement
and `workflows-data-chat` land; once live it SHALL reuse the chat thread UI at
the `manual_ai` level, with context scoped by the current Browse filter state,
and respect the effective AI-usage policy (`all` required for record-data
context).

#### Scenario: Policy below `all`
- **WHEN** a Space's effective AI policy is `schema_only` or `off`
- **THEN** the Data Chat tab shows the policy-locked state instead of a composer
