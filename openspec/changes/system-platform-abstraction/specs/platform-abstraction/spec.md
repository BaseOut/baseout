# platform-abstraction

The source-provider adapter interface contract: a uniform `SourcePlatformClient` every capture/restore consumer depends on, adapter + OAuth-flow registration with catalog gating, platform resolution from context, per-adapter field-type mapping, and an explicit per-adapter payload-schema strategy. Airtable is adapter #1 (wrapping the existing client); a second source platform (e.g. Zite) is adapter #2 with no execution-layer rewrite. This capability is the symmetric source-side counterpart to the destination `StorageWriter` / `resolveStorageWriter` pattern.

Scope note: this capability is **PRD V2** (multi-platform). It is specified now as an explicitly-requested readiness/design artifact; it does not authorize V1 multi-platform, and each requirement below is realized only under a future V2 implementation change.

## ADDED Requirements

### Requirement: Uniform source-platform adapter contract

Baseout SHALL define a single source-platform adapter interface (`SourcePlatformClient`) that every source platform implements, covering capture (list containers, get schema, list records), restore write, and field-value normalization/denormalization. All capture and restore consumers — the backup task, schema diffing, and collaborator sync — SHALL depend on this interface and SHALL NOT import or instantiate a concrete platform client (e.g. `createAirtableClient`) directly. Airtable SHALL be the first adapter, implemented as a wrapper over the existing Airtable client so its behavior and tests are preserved unchanged.

#### Scenario: Capture pipeline is platform-agnostic

- **WHEN** the backup task runs for a Space on any registered platform
- **THEN** it resolves a `SourcePlatformClient` for that Space's platform and drives capture through the interface, with no platform name hardcoded in the pipeline

#### Scenario: Airtable behavior preserved through the adapter

- **WHEN** the Airtable adapter wraps the existing Airtable client
- **THEN** an Airtable Space's backup produces byte-identical output to the pre-adapter path and the existing Airtable test suites pass unchanged

### Requirement: Adapter dispatch factory keyed on platform

Baseout SHALL provide a dispatch factory (`resolveSourceClient(platformSlug, creds)`) that returns the concrete adapter for a platform slug, with one adapter module per platform, mirroring the destination `resolveStorageWriter(storageType, creds)` factory and its one-module-per-provider layout. A request for an unregistered platform SHALL fail closed (no capture attempted) rather than falling back to a different platform's adapter.

#### Scenario: Factory returns the matching adapter

- **WHEN** `resolveSourceClient` is called with a registered platform slug and matching credentials
- **THEN** it returns that platform's adapter implementing the full `SourcePlatformClient` contract

#### Scenario: Unregistered platform fails closed

- **WHEN** `resolveSourceClient` is called with a platform slug that has no registered adapter
- **THEN** it raises rather than returning another platform's adapter, and no capture runs against the wrong client

### Requirement: Catalog gating by adapter and OAuth-flow registration

A source platform SHALL be user-selectable (`SOURCE_PLATFORMS` availability `available`) only when both its `SourcePlatformClient` adapter and its OAuth Connect flow are registered; otherwise it SHALL remain `coming_soon`. This mirrors how destination providers are gated on their OAuth client id in `getDestinationProviders(env)`. Each platform's OAuth Connect flow (start, callback, disconnect) and its connection-persistence module SHALL be isolated per platform, not shared, preserving the per-provider OAuth isolation boundary.

#### Scenario: Half-wired platform stays coming soon

- **WHEN** a platform has a read adapter but no registered OAuth Connect flow
- **THEN** the source-platform catalog reports it as `coming_soon` and it is not offered as a connectable source

#### Scenario: Fully-registered platform becomes available

- **WHEN** a platform has both a registered adapter and a registered OAuth Connect flow
- **THEN** the catalog reports it as `available` and it is selectable in Connect and Space setup

### Requirement: Platform resolved from context, never a string literal

Queries and code paths that need to identify the source platform SHALL resolve it from the owning Space or Connection (its `platformId` / `platformSlug`) or from a threaded parameter, and SHALL NOT compare against a hardcoded platform string (e.g. `eq(platforms.slug, 'airtable')` or `platformSlug === 'airtable'`). Resolution SHALL be behavior-identical for Airtable-only organizations (the resolved platform is `airtable` exactly as before).

#### Scenario: A second platform is not silently excluded

- **WHEN** an Organization has a Connection on a non-Airtable registered platform and a query that previously filtered `platforms.slug = 'airtable'` runs
- **THEN** the query resolves the platform from context and includes the non-Airtable Connection instead of dropping it

#### Scenario: Airtable-only orgs unaffected

- **WHEN** the platform-resolution change ships and an Airtable-only Organization runs any affected query
- **THEN** the results are identical to the pre-change behavior

### Requirement: Field-type mapping owned per adapter

Each adapter SHALL own the mapping between its platform's native field types and Baseout's canonical stored value via `normalizeFieldValue` (capture) and `denormalizeFieldValue` (restore) hooks on the `SourcePlatformClient`. The canonical stored value SHALL remain platform-neutral; no platform-specific field-type logic SHALL live in shared capture/restore code.

#### Scenario: Adapter maps its own field types

- **WHEN** a platform's adapter captures a record whose field uses a platform-specific type
- **THEN** the adapter's `normalizeFieldValue` produces the canonical value, and its `denormalizeFieldValue` reproduces the platform value on restore, without shared code branching on the platform

### Requirement: Explicit per-adapter payload-schema strategy

Each adapter SHALL declare how its captured data maps to per-Space storage — reusing the canonical container/record tables, using its own platform-namespaced schema, or mapping to a normalized shape — and this strategy SHALL be an explicit, documented decision per platform rather than an implicit reuse of the Airtable-shaped tables. The chosen strategy SHALL preserve the control-plane/data-plane split (per-Space data isolated from the master DB) established by the per-Space DB design.

#### Scenario: Second platform's storage mapping is declared, not assumed

- **WHEN** a second source platform is onboarded
- **THEN** its adapter declares its payload-schema strategy explicitly (reuse / platform-namespaced / normalized), and captured data is stored per that declared strategy rather than being forced into the Airtable-namespaced tables by default
