# schema-entity-graph

The engine-assembled cross-entity node/edge graph for the Visualize "Automations &
Interfaces" mode — automations, interfaces, pages, tables, fields and the
references / reads / triggers edges between them.

## ADDED Requirements

### Requirement: Assemble a typed node/edge graph per Space
The engine SHALL assemble, at read time, a single node/edge graph for a Space from
its submitted Automations + Interfaces and its Base/Table/Field schema. Node kinds
SHALL be `automation`, `interface`, `page`, `table`, and `field`. Edge kinds SHALL
be `references` (automation → table/field), `reads` (page → table/field), and
`triggers` (page/interface → automation). Assembly SHALL run synchronously in the
Worker with no Trigger.dev task.

#### Scenario: Graph with automations and interfaces
- **WHEN** a Space has submitted Automations and Interfaces plus captured schema
- **THEN** the graph contains `automation`/`interface`/`page`/`table`/`field` nodes and `references`/`reads`/`triggers` edges assembled from them

#### Scenario: Only schema present
- **WHEN** a Space has captured schema but no submitted Automations or Interfaces
- **THEN** the graph contains schema-derived nodes with no `references`/`reads`/`triggers` edges

### Requirement: Nodes and edges carry active/removed status
Every node SHALL carry a `status` of `active` or `removed`, and every edge SHALL
inherit `removed` when either endpoint is removed. A reference to a soft-deleted
Table/Field SHALL re-point at a `removed` node rather than being dropped, so history
stays visible.

#### Scenario: Reference to a removed field
- **WHEN** an automation references a Field that has been removed from Airtable
- **THEN** the graph includes that field as a `removed` node and the edge to it is marked `removed`

### Requirement: Internal entity-graph route
The engine SHALL expose `GET /api/internal/spaces/:spaceId/entity-graph` returning
`{ ok, nodes, edges }`. It SHALL be token-gated by middleware, reject non-GET with
405 and a bad `spaceId` with 400, return 409 when the Space DB is not ready and 501
for a non-`managed_pg` backend, mirroring `relationships-overview`.

#### Scenario: Successful read
- **WHEN** an authorized internal caller GETs the route for a ready `managed_pg` Space
- **THEN** the engine returns `200 { ok: true, nodes, edges }`

#### Scenario: Space DB not ready
- **WHEN** the Space is not active or has no provisioned per-Space DB
- **THEN** the engine returns `409 space_db_not_ready`

#### Scenario: Wrong method
- **WHEN** the route is called with a method other than GET
- **THEN** the engine returns `405 method_not_allowed`

### Requirement: Web proxy is auth-, IDOR-, and tier-gated
The web app SHALL expose `GET /api/spaces/[spaceId]/entity-graph` that guards the
request with the Schema Docs guard (authentication, ownership/IDOR, and tier), maps
engine error codes through `schemaDocsErrorStatus`, and returns 503 when the engine
binding or token is unconfigured. A non-entitled organization SHALL receive 403.

#### Scenario: Non-entitled organization
- **WHEN** an org without the Schema Docs entitlement requests the entity graph
- **THEN** the proxy returns 403

#### Scenario: Engine unconfigured
- **WHEN** the backup-engine binding or internal token is not configured
- **THEN** the proxy returns 503 `server_misconfigured`

#### Scenario: Cross-organization access
- **WHEN** a user requests the entity graph for a Space their organization does not own
- **THEN** the proxy returns 403
