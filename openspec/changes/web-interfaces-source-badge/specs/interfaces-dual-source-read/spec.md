## ADDED Requirements

### Requirement: Dual-source interface rows merge to one entity per airtable_entity_id

Web reads of `bo_at_interfaces` SHALL group rows by `airtable_entity_id` (rows with a null entity id pass through ungrouped), presenting the MCP-sourced row as authoritative for existence, name, and composition, with any manually-submitted row's payload attached as supplementary detail. No read surface may render the same entity twice.

#### Scenario: Entity with both sources

- **WHEN** an entity id has an MCP row and a manual row
- **THEN** one entity renders, named per the MCP row, carrying the manual payload as supplementary detail, badged with both sources

#### Scenario: MCP-removed but manually documented

- **WHEN** the MCP row is `status='removed'` and a manual row remains active
- **THEN** the entity renders as removed (MCP is existence truth) while retaining the manual context — never as an active duplicate

### Requirement: Provenance is visible

Every rendered interface entity SHALL show its source — automatic (MCP capture), manual (intake), or both — via the governed `StatusBadge` primitive, with the new variants added to its Storybook story in the same change.

#### Scenario: Auto-captured entity

- **WHEN** an entity exists only via MCP capture
- **THEN** it renders with the automatic-capture badge and no manual affordances imply a user submitted it
