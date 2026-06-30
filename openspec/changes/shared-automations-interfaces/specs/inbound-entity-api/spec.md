## ADDED Requirements

### Requirement: Inbound automation/interface endpoints
The `apps/api` service SHALL expose versioned public endpoints to create, edit, and delete Automations and Interfaces for a Space, accepting the same payload shape used by the manual UI form: `POST/PUT/DELETE /v1/spaces/:spaceId/automations` and `POST/PUT/DELETE /v1/spaces/:spaceId/interfaces`. The payload SHALL be the entity's required scalars plus an opaque `definition` body, so a customer can scrape their Airtable environment and submit it directly.

#### Scenario: Create automation via API
- **WHEN** a client POSTs a valid automation payload with `airtableEntityId` and `name`
- **THEN** the entity is recorded and the response returns its id and a recorded status

#### Scenario: Edit via API upserts by entity id
- **WHEN** a client PUTs a payload whose `airtableEntityId` already exists for the Space
- **THEN** the existing entity is updated rather than duplicated

#### Scenario: Delete via API is soft
- **WHEN** a client DELETEs an existing entity by `airtableEntityId`
- **THEN** the entity is marked `status='removed'` and hidden from default listings, with the row and its tags retained for history

#### Scenario: Payload matches UI shape
- **WHEN** the same JSON a customer scrapes is submitted via the API and via the UI form
- **THEN** both produce an equivalent stored row and the same auto-extracted tags

### Requirement: Inbound API authentication and tier gate
The inbound endpoints SHALL authenticate with an Organization API token, resolve the token to an Organization, verify the token's Organization owns the target Space, and enforce the Growth+ capability before any write.

#### Scenario: Missing or invalid token rejected
- **WHEN** a request arrives without a valid Organization API token
- **THEN** it is rejected with an unauthorized error and no write occurs

#### Scenario: Token cannot write to a foreign Space
- **WHEN** a token whose Organization does not own the target Space submits an entity
- **THEN** the request is rejected and no write occurs

#### Scenario: Below-tier rejected
- **WHEN** a token whose Space is below Growth submits an entity
- **THEN** the request is rejected with a tier/capability error

### Requirement: Inbound API validation and forwarding
The inbound endpoints SHALL validate the payload with the shared Zod schema before accepting it, and SHALL forward accepted writes to the engine broker over the HMAC service token rather than writing the per-Space DB directly. Validation errors SHALL return a 4xx naming the offending field.

#### Scenario: Invalid payload rejected at the boundary
- **WHEN** a payload fails schema validation (e.g. a page interface missing its parent, or a missing required field)
- **THEN** the API returns a validation error and does not call the engine

#### Scenario: Accepted write forwarded to engine
- **WHEN** a valid payload passes auth, tier, and validation
- **THEN** the API forwards it to the engine broker over the HMAC service token and returns the engine's result
