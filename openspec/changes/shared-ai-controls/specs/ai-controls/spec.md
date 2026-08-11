## ADDED Requirements

### Requirement: Two-scope, three-level AI-usage policy

The system SHALL store an AI-usage policy of `all | schema_only | off` at both Organization and Space scope (default `all`, existing rows backfilled to `all`), resolving the effective policy as the minimum on the order `off < schema_only < all`. A Space setting SHALL never raise the effective policy above the Organization ceiling; the stored Space value SHALL be preserved so raising the ceiling later restores Space intent.

#### Scenario: Space restricts under a permissive Org

- **WHEN** the Organization is `all` and a Space is set to `schema_only`
- **THEN** that Space's effective policy is `schema_only` while sibling Spaces remain `all`

#### Scenario: Org ceiling clamps

- **WHEN** the Organization is set to `schema_only` and a Space's stored value is `all`
- **THEN** the effective policy is `schema_only`, and restoring the Organization to `all` restores the Space to `all` without re-editing

### Requirement: Server-side enforcement at every AI entry point

Every AI feature SHALL declare its minimum required level (schema-metadata features ≥ `schema_only`; any record-data AI = `all`) and be enforced server-side: route guards reject below-level requests with 403 `ai_disabled_by_policy` (carrying the effective level), context assemblers re-assert the policy immediately before building AI payloads, and workflows enqueues are guarded with the resolved policy carried in the payload. UI gating SHALL be treated as UX only, never the enforcement boundary.

#### Scenario: Off blocks everything

- **WHEN** the effective policy is `off` and any AI request arrives (schema chat, data chat, AI docs)
- **THEN** the engine rejects it with `ai_disabled_by_policy` and no AI payload is assembled

#### Scenario: Schema-only blocks record data

- **WHEN** the effective policy is `schema_only`
- **THEN** schema-metadata AI works and any data-scoped AI request is rejected

### Requirement: Audited, explainable policy changes

Policy writes SHALL require the appropriate admin role per scope, be validated server-side, and append an audit record (actor, scope, old → new). The engine SHALL expose the effective policy plus both raw values so clients can state which scope imposes a restriction.

#### Scenario: Change is audited and explainable

- **WHEN** an Org admin lowers the Organization policy to `schema_only`
- **THEN** an audit row records the change, and the effective-policy read shows Spaces as "restricted by Organization"
