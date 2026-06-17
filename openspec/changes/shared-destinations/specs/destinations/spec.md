## ADDED Requirements

### Requirement: Manage destinations at the account level
The system SHALL let a user create and manage destinations once on their account and reuse them across Spaces, presenting them in a dedicated account-level registry separate from any single Space.

#### Scenario: Destinations registry
- **WHEN** the user opens account Destinations
- **THEN** the system lists every destination with its name, type (file storage or database), status, the number of Spaces using it, and its last write

#### Scenario: Reusable across Spaces
- **WHEN** a destination is linked to one or more Spaces
- **THEN** the registry shows how many Spaces use it ("in use by"), and the same destination object backs every linked Space

#### Scenario: Empty registry
- **WHEN** the account has no destinations
- **THEN** the system shows an empty state inviting the user to add a file store and, optionally, a database

### Requirement: Add a destination
The system SHALL let the user add a destination by choosing a type, then naming and configuring it; a file destination is the everyday store and a database destination is an encouraged, optional extra.

#### Scenario: Choose a destination type
- **WHEN** the user adds a destination
- **THEN** the system offers file-storage types (managed Baseout R2, Google Drive, Dropbox, Box, Amazon S3) and database types (Postgres, Neon, Supabase, other), with the database group marked recommended but optional

#### Scenario: A created destination needs connection
- **WHEN** the user saves a new destination that requires authorization
- **THEN** the destination is created and appears in the registry with a "Needs connection" status until it is connected (a managed destination that needs no authorization is created already connected)

#### Scenario: The database is encouraged, never required
- **WHEN** the user is choosing destinations
- **THEN** the database option is presented as recommended with its benefits, but the user can proceed with only a file destination

### Requirement: Connect, reconnect, and remove a destination
The system SHALL carry each destination's status and let the user connect or reconnect it independently of any Space, and SHALL guard removal of a destination that Spaces still use.

#### Scenario: Connect a new destination
- **WHEN** a destination is "Needs connection"
- **THEN** the destination's own page offers a Connect action that, once completed, marks it Connected

#### Scenario: Reconnect a broken destination
- **WHEN** a destination has lost access
- **THEN** it shows a "Reconnect" status, the registry surfaces that backups to it are paused and how many Spaces are affected, and reconnecting it once restores backups for every linked Space

#### Scenario: Removal guarded while in use
- **WHEN** the user tries to remove a destination that one or more Spaces use
- **THEN** removal is blocked with an explanation to unlink those Spaces first

### Requirement: Link account destinations from a Space's setup
The system SHALL let a Space's backup setup use the account destinations, by either picking existing ones or adding a new one, with a required file destination and an optional database destination.

#### Scenario: Pick an existing destination in setup
- **WHEN** configuring a Space's backup
- **THEN** the user can select a file destination (required) and, optionally, a database destination from the account's existing destinations

#### Scenario: Add a destination from setup
- **WHEN** no suitable destination exists during setup
- **THEN** the user can add a new destination, which is created at the account level and becomes available to link

### Requirement: Show provider availability and honest connection status
The system SHALL present, across the account Destinations surfaces, which providers can be connected now versus those that are coming soon (including tier-gated providers), and SHALL derive each existing destination's status from real signals rather than assuming it is connected. Provider availability SHALL come from a single shared catalog so the account registry and the per-Space storage picker never disagree.

#### Scenario: Available vs coming-soon in the add flow
- **WHEN** the user opens the Add destination flow
- **THEN** providers that can be connected now are selectable, and providers that are not yet available — an env-gated bring-your-own-storage provider that is not configured, or a tier-gated provider — are shown disabled with a "Coming soon" label and, where applicable, the tier required (e.g. "Growth+")

#### Scenario: Coming-soon providers visible on the registry
- **WHEN** the user views account Destinations
- **THEN** the surface indicates the additional providers that are available to add or coming soon, so the user can see what they can connect next

#### Scenario: Honest connection status
- **WHEN** a destination is shown in the registry
- **THEN** its status reflects real signals — a managed destination (Baseout R2 / local disk) is Connected, a bring-your-own destination with an authorized account is Connected, and an unauthorized destination is "Needs connection" — rather than a hardcoded value
