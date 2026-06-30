## ADDED Requirements

### Requirement: Interface/page → automation links
The system SHALL support linking an Interface or Page to an Automation it triggers, stored as a `bo_at_entity_tags` row with `source_type='interface'`, `source_id` = the interface/page row id, `target_type='automation'`, and `target_id` = the referenced Automation's `airtableEntityId`. This SHALL require no new table and no schema migration — `target_type` is the existing free-text column gaining an accepted value.

#### Scenario: Automation link stored
- **WHEN** a page that triggers an automation is recorded with a reference to that automation
- **THEN** a `bo_at_entity_tags` row with `target_type='automation'` linking the page to the automation's `airtableEntityId` exists

#### Scenario: Validation accepts the new target type
- **WHEN** a link entry with `target_type='automation'` is submitted
- **THEN** validation accepts it (alongside `table` and `field`) and the link is persisted

### Requirement: Automation links from definition extraction
On every interface/page create or edit, the extraction walker SHALL look for automation references in the entity's `definition`, resolve each to an Automation in the same Space and Base, and upsert an `added_via='auto'` automation-target tag. Unresolvable references SHALL be skipped without failing the write, and manual automation tags SHALL be preserved across re-extraction, consistent with table/field tag behavior.

#### Scenario: Auto-extracted automation link
- **WHEN** an interface page whose `definition` references an automation that exists in the Space is saved
- **THEN** an `added_via='auto'` tag links the page to that automation

#### Scenario: Unresolvable automation reference skipped
- **WHEN** extraction finds an automation reference that resolves to no known automation
- **THEN** the write succeeds and no automation tag is created for it

#### Scenario: Manual automation link preserved
- **WHEN** a user has manually linked a page to an automation and the page is later edited
- **THEN** re-extraction does not remove the manual automation link

### Requirement: Automation links via inbound API and UI
The system SHALL accept interface→automation link entries on the inbound REST interface payload (under the same Org-API-token auth, Growth+ gate, and validation as other links) and via the UI tag-picker, and SHALL forward them through the engine broker like table/field links.

#### Scenario: Link supplied via inbound API
- **WHEN** a valid interface payload includes an automation link entry
- **THEN** the engine persists it as a `target_type='automation'` tag

#### Scenario: Link added via UI
- **WHEN** a user adds an automation to a page's tag-picker
- **THEN** a manual automation-target tag is created and the page→automation edge appears in the graph
