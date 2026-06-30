## ADDED Requirements

### Requirement: Entity-graph payload model
The engine SHALL produce an entity-graph payload of typed nodes and directed edges. Each node SHALL carry a stable, type-namespaced id, a `type` (`automation | interface | page | table | field`), a human label, a `status`, and its `baseId`. Each edge SHALL carry a `kind`: `references` (automation→table/field), `reads` (page→table/field), or `triggers` (page/interface→automation), plus its `addedVia`. The payload SHALL include `status='removed'` entities (not drop them) so consumers can render history.

#### Scenario: Typed nodes and edge kinds
- **WHEN** the payload is assembled for a Space whose automation references a Table and whose page triggers that automation
- **THEN** it contains typed nodes for the automation, page, and table, a `references` edge, and a `triggers` edge

#### Scenario: Removed entities included
- **WHEN** an automation has been soft-deleted (`status='removed'`)
- **THEN** it is present in the payload with `status='removed'` rather than omitted

### Requirement: Engine-assembled graph read
The system SHALL expose an `x-internal-token`-gated `GET /api/internal/spaces/:spaceId/entity-graph` (optionally scoped by `baseId`) that assembles the full node/edge payload from `bo_at_automations`, `bo_at_interfaces`, and `bo_at_entity_tags` (plus `bo_at_tables`/`bo_at_fields` for labels) in one per-Space read, and `apps/web` SHALL consume it through an authenticated, IDOR- and Growth+-capability-gated `/api/spaces/[spaceId]/entity-graph` proxy that returns the payload in a single response.

#### Scenario: Single read assembles the payload
- **WHEN** the entity-graph endpoint is called for a Space
- **THEN** it returns the complete nodes + edges payload from one per-Space read, not multiple list calls

#### Scenario: Base scoping
- **WHEN** the endpoint is called with a `baseId`
- **THEN** only that Base's nodes and edges are returned

#### Scenario: IDOR attempt blocked
- **WHEN** an authenticated user requests the entity graph for a Space their Organization does not own
- **THEN** the proxy rejects the request without calling the engine

#### Scenario: Below-tier blocked
- **WHEN** a Space below Growth requests the entity graph
- **THEN** the request is rejected with a tier/capability error
