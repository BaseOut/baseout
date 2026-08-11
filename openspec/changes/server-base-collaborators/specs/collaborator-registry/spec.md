## ADDED Requirements

### Requirement: Principals table (central identity registry)

The per-Space schema SHALL include a `bo_at_principals` table (mirrored in `packages/db-schema/src/space/{sqlite,pg,pg-ddl}.ts`): one row per distinct principal observed anywhere in a Space — `principal_id` (Airtable `usr…` or `ugp…` id, unique), `kind` (`user` | `group`), `email` (nullable — the metadata payload provides it for users only), `name` (nullable — the payload provides it for groups only; user names are enriched opportunistically from other captured sources such as comment authors, and from the enterprise user API in future), plus first/last-seen stamps. Principal rows SHALL never be deleted — revocation is expressed on grant rows; a principal with zero active grants is retained as history. The schema SHALL accommodate future enterprise-sourced identity columns without redesign.

#### Scenario: User principal from a collaborator entry

- **WHEN** a capture contains an individual collaborator entry with `userId` and `email`
- **THEN** a principal row SHALL exist with `principal_id` = that userId, `kind='user'`, and the email persisted

#### Scenario: Group principal

- **WHEN** a capture contains a group collaborator entry
- **THEN** a principal row SHALL exist with `principal_id` = the groupId, `kind='group'`, and the group's `name` persisted

#### Scenario: Granter seeded as principal

- **WHEN** a collaborator entry carries a `grantedByUserId` not otherwise present in the capture
- **THEN** a principal row SHALL exist for that id (`kind='user'`, identity fields NULL until enriched)

#### Scenario: Opportunistic name enrichment does not regress

- **WHEN** a principal's `name` or `email` is already populated and a later capture lacks that field
- **THEN** the populated value SHALL be retained (fields only fill, never blank)

### Requirement: Base-access grants table (link table)

The per-Space schema SHALL include a `bo_at_base_access` table linking principals to bases: `principal_id` (references `bo_at_principals`), `base_id`, `interface_id` (empty-string-normalized for non-interface scopes), `scope` (`individual_base` | `individual_workspace` | `group_base` | `group_workspace` | `individual_interface` | `group_interface`), `permission_level`, `granted_by_user_id`, `airtable_created_time`, lifecycle `status` (`active` | `deleted`), and first/last-seen run + timestamp stamps; unique on `(base_id, interface_id, scope, principal_id)`. Workspace-derived grants SHALL be recorded per base (one row per base the capture covers), with the scope preserving their workspace origin.

#### Scenario: Grant row for an individual base collaborator

- **WHEN** a capture for base B contains an `individualCollaborators.baseCollaborators` entry
- **THEN** a grant row SHALL exist linking that principal to B with `scope='individual_base'`, the entry's `permissionLevel`, `grantedByUserId`, and `createdTime`

#### Scenario: Workspace grant recorded per base

- **WHEN** the same workspace collaborator appears in captures for bases B1 and B2
- **THEN** one principal row and two grant rows (one per base, `scope='individual_workspace'`) SHALL exist

### Requirement: Invite-links table

The per-Space schema SHALL include a `bo_at_invite_links` table with: `airtable_invite_id`, `base_id`, `interface_id` (normalized as above), `link_scope` (`base` | `workspace` | `interface`), `invited_email` (nullable), `permission_level`, `referred_by_user_id` (seeded as a principal), `restricted_to_email_domains` (JSON array), `type` (`singleUse` | `multiUse`), `airtable_created_time`, lifecycle `status`, and seen stamps; unique on `(base_id, interface_id, link_scope, airtable_invite_id)`.

#### Scenario: Outstanding base invite link persisted

- **WHEN** a capture contains an `inviteLinks.baseInviteLinks` entry
- **THEN** a row SHALL exist with `link_scope='base'` and the entry's id, permission level, type, email restriction list, and referrer

### Requirement: Collaborators-sync route ingests canonical blocks with deprecated fallback

The `POST /api/internal/spaces/collaborators-sync` route (INTERNAL_TOKEN-gated) SHALL ingest collaborators from `individualCollaborators` and `groupCollaborators` (base + workspace lists) and from each entry of `interfaces` (individual + group collaborator lists and interface invite links, with `interface_id` set) — upserting principals and grant rows. Entries in the deprecated top-level `collaborators` block SHALL be ingested with the matching `individual_*` scope ONLY when not already present from the canonical blocks; the grant table's unique key SHALL prevent double-ingestion.

#### Scenario: Deprecated block duplicates canonical entry

- **WHEN** the same `userId` appears in both `individualCollaborators.baseCollaborators` and the deprecated `collaborators.baseCollaborators`
- **THEN** exactly one grant row SHALL exist for that principal with `scope='individual_base'`

#### Scenario: Interface collaborator ingested

- **WHEN** a capture's `interfaces` map contains a page bundle with an `individualCollaborators` entry
- **THEN** a grant row SHALL exist with `scope='individual_interface'` and `interface_id` set to the page-bundle id

### Requirement: Run-over-run revocation diffing on grants

Each capture SHALL be treated as the complete current access state for its base: observed grants are upserted with bumped last-seen stamps (permission-level changes update in place), `active` grant rows for that base absent from the capture SHALL be marked `deleted`, previously `deleted` grants that reappear SHALL be resurrected to `active`, and principal rows SHALL never be deleted by diffing. The same lifecycle applies to invite links.

#### Scenario: Collaborator removed in Airtable

- **WHEN** a principal present in the prior capture for a base is absent from a successful new capture
- **THEN** its grant rows for that base SHALL be marked `status='deleted'` with the run stamp, and its principal row SHALL remain

#### Scenario: Permission level changed

- **WHEN** a principal reappears with a different `permissionLevel`
- **THEN** the grant row SHALL be updated in place to the new level and remain `active`

### Requirement: Space-wide access view is a plain join

The two-table model SHALL support listing, for a Space, every known principal with their per-base access (base, scope, permission level, granted-by, since-when, active/revoked) as a join of `bo_at_principals` to `bo_at_base_access` — no per-base fan-out queries.

#### Scenario: Users-by-access listing

- **WHEN** a consumer queries principals joined to active grants across all monitored bases in a Space
- **THEN** each principal SHALL appear once with one row per (base, scope) grant, including permission level and timestamps

### Requirement: Base registry enrichment and raw retention

From each capture, the engine SHALL stamp the base's `workspaceId`, its Airtable `createdTime`, and the token's own `permissionLevel` onto the base's registry row, and SHALL retain the un-modeled blocks (`packages`, and the raw payload) on the capture record for future ingestion.

#### Scenario: Workspace id stamped

- **WHEN** a capture arrives for a base whose registry row has no workspace id
- **THEN** the registry row SHALL carry the capture's `workspaceId` afterward

### Requirement: Best-effort capture posture

A failed metadata fetch for a base SHALL mark the collaborator step `skipped(reason)` in run progress without failing the run, and SHALL NOT trigger deletion diffing for that base (absence of a capture is not evidence of revocation).

#### Scenario: Metadata call fails for one base

- **WHEN** the metadata endpoint returns an error for one base in a run
- **THEN** that base's existing grant rows SHALL be untouched and the run SHALL continue
