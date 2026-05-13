## ADDED Requirements

### Requirement: Version-incrementing UPSERT

When a submission for an existing logical entity (same `space_id` + `entity_type` + `airtable_entity_id`) arrives, the inbound layer SHALL INSERT a new row with `version` = previous max version + 1. Historical versions SHALL be preserved.

#### Scenario: First submission of an automation

- **WHEN** a Growth Space submits an automation with `airtableEntityId='aut_abc'` and no prior row exists
- **THEN** the table SHALL gain one row with `version=1`, `submission_source` set to the originating intake

#### Scenario: Re-submission of same automation

- **WHEN** the same Space later submits an automation with the same `airtableEntityId='aut_abc'`
- **THEN** the table SHALL gain a new row with `version=2`, leaving the `version=1` row intact

### Requirement: Tier-gated entity submission

The Inbound API endpoints SHALL consult `resolveSubmittedEntityCapability(tier)` and reject submissions for entity types not available at the Space's Org tier. Per PRD authority resolution: Automations + Interfaces require Growth+; Documentation requires Pro+.

#### Scenario: Launch tier blocked from automations

- **WHEN** a Launch Org's API token POSTs to `/v1/spaces/:id/automations`
- **THEN** the route SHALL return 403 `{ error: 'entity_type_not_available_at_tier', requires: 'growth' }`

#### Scenario: Growth tier blocked from documentation

- **WHEN** a Growth Org's API token POSTs to `/v1/spaces/:id/documentation`
- **THEN** the route SHALL return 403 `{ error: 'entity_type_not_available_at_tier', requires: 'pro' }`

### Requirement: Backup-run inclusion

Each backup run for a Space with submitted entities SHALL include the latest version of each logical entity in the snapshot. Static-mode runs SHALL write `submitted-<type>.json` to the storage destination next to the records CSV. Dynamic-mode runs SHALL UPSERT into `_baseout_<type>` tables in the per-Space dynamic DB.

#### Scenario: Static-mode run includes JSON files

- **WHEN** a Growth Space with 3 submitted automations and 0 interfaces runs a static-mode backup
- **THEN** R2 SHALL contain `<spaceId>/<runId>/submitted-automation.json` with an array of 3 automation payloads, and SHALL NOT contain a `submitted-interface.json` for this run

#### Scenario: Dynamic-mode run UPSERTs entity tables

- **WHEN** a Pro Space with submitted documentation runs a dynamic-mode backup
- **THEN** the Space's dynamic DB SHALL contain rows in `_baseout_custom_documentation` matching the latest version per logical entity

### Requirement: Payload size limit

The Inbound API endpoints SHALL reject submissions whose JSON payload exceeds 1 MB. The cap SHALL apply per individual submission, not per Space cumulative.

#### Scenario: Oversize submission rejected

- **WHEN** a Pro Space submits Documentation with a 2 MB payload
- **THEN** the route SHALL return 400 `{ error: 'payload_too_large', maxBytes: 1048576 }`
