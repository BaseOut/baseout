## ADDED Requirements

### Requirement: Automation storage shape
The system SHALL store each Automation as a row in the per-Space `bo_at_automations` table scoped to a Base, with required scalar columns `airtable_entity_id` and `name`, optional `type` (the Airtable trigger type) and `status`, and the full configuration in the opaque `definition` JSONB column. The system SHALL NOT model individual triggers, actions, or conditions as separate relational tables.

#### Scenario: Create requires id and name
- **WHEN** an Automation is submitted (via UI or API) without `airtableEntityId` or without `name`
- **THEN** the system rejects it with a validation error naming the missing required field
- **AND** no row is written

#### Scenario: Full config preserved verbatim
- **WHEN** an Automation is submitted with a `definition` containing trigger/action/condition objects of types the system does not recognize
- **THEN** the system stores `definition` unchanged
- **AND** persists `airtableEntityId`, `name`, and `type` to their columns

### Requirement: Automation upsert by Airtable entity id
The system SHALL treat `(space, base, airtableEntityId)` as the identity of an Automation: a submission whose `airtableEntityId` already exists updates that row (refreshing `definition`, `name`, `type`, `status`, `lastSeenAt`) rather than creating a duplicate.

#### Scenario: Re-submission updates in place
- **WHEN** an Automation with an `airtableEntityId` that already exists in the Space+Base is submitted again
- **THEN** the existing row is updated and `lastSeenAt` advances
- **AND** no second row is created

### Requirement: Automation Table/Field tags
The system SHALL link each Automation to the Tables and Fields it references via `bo_at_entity_tags` (`source_type='automation'`). On every create or edit the system SHALL auto-extract referenced Tables/Fields from `definition`, resolve their names to Airtable ids against the Space's current schema, and upsert tags with `added_via='auto'`. The system SHALL also allow tags to be added or removed manually with `added_via='manual'`, and SHALL NOT overwrite or delete manual tags during auto-extraction.

#### Scenario: Auto-extraction on write
- **WHEN** an Automation whose `definition` references table "Podcast Guests" is created and that table exists in the Space schema
- **THEN** an `added_via='auto'` tag linking the Automation to that Table's id is created

#### Scenario: Unresolvable reference is skipped, not failed
- **WHEN** auto-extraction finds a referenced table/field name that no longer exists in the Space schema
- **THEN** the write still succeeds
- **AND** no tag is created for the unresolved reference

#### Scenario: Manual tag preserved across re-extraction
- **WHEN** a user has added a manual tag and the Automation is later edited
- **THEN** auto-extraction re-runs without removing the manual tag

#### Scenario: Tag is queryable from both directions
- **WHEN** an Automation tags a Table
- **THEN** the link is readable both as the Automation's tag list and as the set of Automations tagging that Table

### Requirement: Automation soft-delete and reactivation
Deleting an Automation SHALL be soft: the system sets `status='removed'` and excludes it from default reads while retaining the row and its `bo_at_entity_tags` for history. A later submission of the same `airtableEntityId` SHALL reactivate the existing row (`status='active'`) rather than create a duplicate.

#### Scenario: Delete is soft and retains history
- **WHEN** an Automation is deleted
- **THEN** its row is marked `status='removed'` and excluded from default reads
- **AND** the row and its `bo_at_entity_tags` are retained

#### Scenario: Re-submission reactivates a removed Automation
- **WHEN** an Automation with the `airtableEntityId` of a previously removed row is submitted again
- **THEN** the existing row is reactivated to `status='active'` rather than duplicated

### Requirement: Automation intake is tier-gated
The system SHALL gate Automation intake at Growth+ resolved from cached Stripe metadata, rejecting write attempts below the gate at both the inbound API and the `apps/web` proxy.

#### Scenario: Below-tier write rejected
- **WHEN** a Space below Growth attempts to create an Automation via the inbound API
- **THEN** the request is rejected with a tier/capability error and no row is written

### Requirement: Automation access is ownership-scoped
The system SHALL ensure every per-Space Automation read/write passes through the engine broker behind the `x-internal-token` gate, and that `apps/web` proxy routes verify the authenticated user owns the target Space before forwarding.

#### Scenario: IDOR attempt blocked
- **WHEN** an authenticated user requests Automations for a Space their Organization does not own
- **THEN** the proxy rejects the request without calling the engine
