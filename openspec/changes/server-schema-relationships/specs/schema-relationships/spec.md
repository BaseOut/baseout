## ADDED Requirements

### Requirement: Relationship + link data model

Relationships SHALL be stored per-Space in `bo_at_relationships` (`type`, `origin`, `status`, `first_seen_run`, `last_seen_run`) and a many-to-many `bo_at_relationship_links` pairing two entities (`entity_a_type/id`, `entity_b_type/id`) with a link `status` (`active` | `removed`) and `first_seen_run` / `removed_run`. A relationship MAY have many links (e.g. a formula's relationship pairs the formula field with each referenced field), and an entity MAY appear in many links across relationships.

#### Scenario: Formula referencing multiple fields

- **WHEN** a formula field references three fields
- **THEN** one `bo_at_relationships` (type `formula`) row exists with three `bo_at_relationship_links`, each pairing the formula field with one referenced field

### Requirement: API-derived detection during schema processing

During schema processing, the system SHALL create/update relationships from the captured schema: `linked_records` (linked-record fields → target table/reciprocal field), `formula` (formula field → referenced fields), `rollup` / `lookup` (field → source linked field + target field), and `last_modified` (`lastModifiedBy`/`lastModifiedTime` → tracked field/table). These SHALL have `origin = api` and default `status = confirmed`.

#### Scenario: Linked-record relationship detected

- **WHEN** a base's schema has a linked-record field pointing at another table
- **THEN** a `linked_records` relationship (origin `api`) is created with a link pairing the field and the target table

### Requirement: Link removal preserves history

When a previously-seen link is no longer present (a referenced field removed, a linked record gone, an inferred match no longer holding), its link SHALL be set to `status = removed` with `removed_run` rather than deleted, so the history and the entity association are preserved.

#### Scenario: Linked record removed

- **WHEN** a linked-record field that previously formed a relationship is deleted in Airtable
- **THEN** the corresponding link is marked `removed` (with `removed_run`), retained for history, still associated with its tables

### Requirement: Computed relationship validity

A relationship's validity SHALL be computed, not stored: it is valid iff it has at least one `active` link, and invalid when all of its links are `removed`.

#### Scenario: Relationship becomes invalid

- **WHEN** every link of a relationship is `removed`
- **THEN** the relationship is reported as invalid (computed), with no stored validity field, and its record + removed links are retained

### Requirement: Confirm / dismiss lifecycle for inferred relationships

A user MAY confirm an inferred relationship (`status` → `confirmed`) or dismiss/remove it (`status` → `dismissed`). Dismissed relationships SHALL be retained so inference does not recreate them. API-derived relationships SHALL NOT be user-editable in this way.

#### Scenario: Confirming an inferred synced view

- **WHEN** a user confirms an `inferred` synced-view relationship
- **THEN** its `status` becomes `confirmed` and it is treated as a user-acknowledged relationship

#### Scenario: Dismissing prevents recreation

- **WHEN** a user dismisses an inferred relationship
- **THEN** its `status` becomes `dismissed` and the next inference run does not recreate it

### Requirement: Read and click-through API

The engine SHALL expose endpoints to list a Space's relationships (grouped by base and type, with computed validity and `inferred`/`removed` flags) and to read a relationship's links + the referenced entities' details, so the UI can render the relationship and click through to each entity's detail sidebar.

#### Scenario: Inspecting a relationship

- **WHEN** a user opens a relationship in the Relationships tab
- **THEN** its linked entities (with type + names) are returned, each navigable to its entity detail
</content>
