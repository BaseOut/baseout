## ADDED Requirements

### Requirement: Interface storage shape
The system SHALL store each Interface as a row in the per-Space `bo_at_interfaces` table scoped to a Base, with required scalar columns `airtable_entity_id` and `type` (`interface | page`), an optional `name`, a `parent_interface_id` column, and the full configuration in the opaque `definition` JSONB column. The system SHALL NOT model individual interface pages, elements, or layouts as separate relational tables.

#### Scenario: Create requires id and type
- **WHEN** an Interface is submitted without `airtableEntityId` or with a `type` that is not `interface` or `page`
- **THEN** the system rejects it with a validation error and writes no row

#### Scenario: Full config preserved verbatim
- **WHEN** an Interface is submitted with a `definition` whose element/layout shape the system does not recognize
- **THEN** the system stores `definition` unchanged and persists the required scalars

### Requirement: Nested interface submissions are flattened
The system SHALL accept a submission that nests Pages under their Interface (`interfaces[].pages[]`) and flatten it into one `bo_at_interfaces` row per Interface plus one row per Page. The system SHALL map `airtableEntityId` to each entity's own id (the Interface's `interfaceId`, the Page's `pageId`) and set a Page's `parentInterfaceId` to the parent `interfaceId`. A flat per-entity submission and an equivalent nested submission SHALL produce identical stored rows.

#### Scenario: Nested payload produces a row per entity
- **WHEN** an Interface with one nested Page is submitted
- **THEN** two rows are stored — the Interface (no parent) and the Page (parent = the Interface id, `airtableEntityId` = the Page's `pageId`)

#### Scenario: Nested and flat submissions converge
- **WHEN** the same data is submitted once nested and once as separate flat entities
- **THEN** the resulting rows and tags are equivalent

### Requirement: Page requires a parent interface
The system SHALL require that any Interface row of `type='page'` references an existing Interface row of `type='interface'` via `parent_interface_id`, and SHALL reject a page submission whose parent is missing or is not itself an `interface`.

#### Scenario: Page without parent rejected
- **WHEN** an Interface of `type='page'` is submitted without a `parentInterfaceId`
- **THEN** the system rejects it with a validation error

#### Scenario: Page with valid parent accepted
- **WHEN** an Interface of `type='page'` is submitted whose `parentInterfaceId` resolves to an existing `type='interface'` row in the same Space+Base
- **THEN** the page is stored and linked to its parent

### Requirement: Interface upsert by Airtable entity id
The system SHALL treat `(space, base, airtableEntityId)` as the identity of an Interface: a re-submission updates the existing row rather than creating a duplicate.

#### Scenario: Re-submission updates in place
- **WHEN** an Interface with an existing `airtableEntityId` is submitted again
- **THEN** the existing row is updated and `lastSeenAt` advances, with no duplicate row

### Requirement: Interface Table/Field tags
The system SHALL link each Interface (including Pages) to the Tables and Fields it references via `bo_at_entity_tags` (`source_type='interface'`), using the same auto-extract-on-write plus manual-add behavior defined for Automations, readable from both directions. Auto-extraction for Pages SHALL read `sourceTable` (→ Table) and `detailFieldsShown[]` (→ Fields) from `definition`.

#### Scenario: Auto-extraction from sourceTable and detailFieldsShown
- **WHEN** a Page whose `definition` has `sourceTable` "Live Shows" and `detailFieldsShown` including "Status" is saved, and those entities exist in the Space schema
- **THEN** `added_via='auto'` tags link the Page to the "Live Shows" Table and to the "Status" Field

#### Scenario: Manual tag preserved across re-extraction
- **WHEN** a user adds a manual tag and the Interface is later edited
- **THEN** re-extraction does not remove the manual tag

### Requirement: Interface soft-delete and reactivation
Deleting an Interface SHALL be soft: the system sets `status='removed'`, excludes it from default reads, and retains the row and its `bo_at_entity_tags` for history. A later submission of the same `airtableEntityId` SHALL reactivate the existing row rather than create a duplicate.

#### Scenario: Delete is soft and retains history
- **WHEN** an Interface is deleted
- **THEN** its row is marked `status='removed'` and excluded from default reads, with the row and its `bo_at_entity_tags` retained

### Requirement: Interface intake is tier-gated and ownership-scoped
The system SHALL gate Interface intake at Growth+ from cached Stripe metadata, route all per-Space I/O through the engine broker behind the `x-internal-token` gate, and verify Space ownership in `apps/web` proxy routes before forwarding.

#### Scenario: Below-tier write rejected
- **WHEN** a Space below Growth attempts to create an Interface
- **THEN** the request is rejected with a tier/capability error and no row is written

#### Scenario: IDOR attempt blocked
- **WHEN** an authenticated user requests Interfaces for a Space their Organization does not own
- **THEN** the proxy rejects the request without calling the engine
