## ADDED Requirements

### Requirement: Engine brokers all Schema Docs reads and writes
The engine SHALL expose `INTERNAL_TOKEN`-gated routes for per-Space document CRUD, tagging, links, diagrams, and entity-scoped reads. `apps/web` SHALL NOT connect to a per-Space DB directly; all reads and writes go through the engine. The engine SHALL treat the Plate document `body` and the React Flow diagram `state` as opaque JSON and SHALL NOT validate their internal node shapes (avoiding backend↔editor-library version coupling). Document reads/writes are supported on the `managed_pg` backend; `d1` and `byodb` return `501` until those backends land.

#### Scenario: Create and list documents
- **WHEN** a `POST` is made to the documents collection route for a Space with an active `managed_pg` per-Space DB
- **THEN** a `bo_at_documents` row is written with a server-derived `excerpt` and the created document is returned
- **AND** a subsequent `GET` lists it

#### Scenario: Unsupported backend
- **WHEN** a document route is called for a Space whose per-Space DB backend is `d1` or `byodb`
- **THEN** the engine SHALL respond `501`

#### Scenario: Missing internal token
- **WHEN** an `/api/internal/*` document route is called without a valid `x-internal-token`
- **THEN** the engine SHALL respond `401`

### Requirement: Documents tag schema entities and surface on their detail panels
A document MAY tag any number of entities (`base`/`table`/`field`/`view`) by Airtable id, added inline in the editor or explicitly. The tag SHALL surface on the tagged entity's detail view and be removable from either side. The association is stored in `bo_at_document_tags` and is never deleted by schema sync.

#### Scenario: Tagging surfaces on the entity
- **WHEN** a document tags a field, inline or via the tags panel
- **THEN** a `bo_at_document_tags` row is written and the document appears in that field's Documentation section on the Browse tab

#### Scenario: Tagged entity removed from the schema
- **WHEN** an entity tagged by a document is later removed from Airtable (its entity row is absent or `status='removed'`)
- **THEN** the engine read SHALL return the tag with an `entityRemoved` flag set
- **AND** the tag SHALL NOT be deleted — the reference is retained and shown flagged

#### Scenario: Multiple saved diagrams per document
- **WHEN** an author saves a scoped mini-diagram in a document
- **THEN** its serialized React Flow state is stored as a `bo_at_document_diagrams` row, and a document MAY hold several such diagrams

### Requirement: Browse and Docs tabs on the Schema page
The web Schema page SHALL provide a **Browse** tab (an entity list with a detail panel whose Documentation section lists docs tagged to that entity) and a **Docs** tab (a document list plus an editor with a rich-text body, entity tags, named external links, and mini-diagrams). The rich-text editor and diagram canvas are React islands hydrated `client:visible`. The browser reaches these only through authenticated `apps/web` proxy routes, never the engine directly.

#### Scenario: Author a document
- **WHEN** a signed-in user on an entitled tier opens the Docs tab and creates a document
- **THEN** the request is proxied through an authenticated `apps/web` `/api/spaces/[spaceId]/*` route to the engine
- **AND** the new document appears in the Docs list

#### Scenario: IDOR protection
- **WHEN** a user requests documents for a Space not in their Organization
- **THEN** the `apps/web` proxy SHALL respond `403` before calling the engine

### Requirement: Schema Docs is tier-gated
Schema Docs SHALL be gated by tier: unavailable on Trial/Starter (`none`), manual authoring on Launch and Growth (`manual`), AI-assisted generation additionally on Pro/Business/Enterprise (`manual_ai`). The gate SHALL be resolved from the cached Stripe-synced tier (never product-name strings) and enforced server-side in the `apps/web` proxy routes. AI generation itself is deferred ("soon").

#### Scenario: Below the gate
- **WHEN** a Starter-tier user calls a document route or opens the Docs tab
- **THEN** the proxy SHALL respond `403`
- **AND** the Docs tab SHALL render an upsell empty state rather than an editor

#### Scenario: AI affordance deferred
- **WHEN** a Pro+-tier user opens the editor
- **THEN** a "Generate with AI" control SHALL be shown disabled and labeled "Soon"
- **AND** no AI generation request is made
