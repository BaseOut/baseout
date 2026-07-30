## ADDED Requirements

### Requirement: Collaborators table

The per-Space schema SHALL include a `bo_at_collaborators` table (mirrored in `packages/db-schema/src/space/{sqlite,pg,pg-ddl}.ts`) with: `base_id`, `interface_id` (empty-string-normalized for non-interface scopes), `scope` (`individual_base` | `individual_workspace` | `group_base` | `group_workspace` | `individual_interface` | `group_interface`), `permission_level`, `email` and `user_id` (individual scopes), `group_id` and `group_name` (group scopes), `granted_by_user_id`, `airtable_created_time`, lifecycle `status` (`active` | `deleted`), and first/last-seen run + timestamp stamps. The table SHALL be unique on `(base_id, interface_id, scope, principal_id)` where `principal_id` is `user_id` for individual scopes and `group_id` for group scopes.

#### Scenario: Individual base collaborator row

- **WHEN** a capture contains an `individualCollaborators.baseCollaborators` entry
- **THEN** a row SHALL exist with `scope='individual_base'`, the entry's `email`, `userId`, `grantedByUserId`, `permissionLevel`, and `createdTime`

#### Scenario: Group workspace collaborator row

- **WHEN** a capture contains a `groupCollaborators.workspaceCollaborators` entry
- **THEN** a row SHALL exist with `scope='group_workspace'`, the entry's `groupId`, `name` as `group_name`, and NULL `email`/`user_id`

### Requirement: Invite-links table

The per-Space schema SHALL include a `bo_at_invite_links` table with: `airtable_invite_id`, `base_id`, `interface_id` (normalized as above), `link_scope` (`base` | `workspace` | `interface`), `invited_email` (nullable), `permission_level`, `referred_by_user_id`, `restricted_to_email_domains` (JSON array), `type` (`singleUse` | `multiUse`), `airtable_created_time`, lifecycle `status`, and seen stamps; unique on `(base_id, interface_id, link_scope, airtable_invite_id)`.

#### Scenario: Outstanding base invite link persisted

- **WHEN** a capture contains an `inviteLinks.baseInviteLinks` entry
- **THEN** a row SHALL exist with `link_scope='base'` and the entry's id, permission level, type, email restriction list, and referrer

### Requirement: Collaborators-sync route ingests canonical blocks with deprecated fallback

The `POST /api/internal/spaces/collaborators-sync` route (INTERNAL_TOKEN-gated) SHALL ingest collaborators from `individualCollaborators` and `groupCollaborators` (base + workspace lists), and from each entry of `interfaces` (individual + group collaborator lists and interface invite links, with `interface_id` set). Entries in the deprecated top-level `collaborators` block SHALL be ingested with the matching `individual_*` scope ONLY when not already present from the canonical blocks; the unique key SHALL prevent double-ingestion.

#### Scenario: Deprecated block duplicates canonical entry

- **WHEN** the same `userId` appears in both `individualCollaborators.baseCollaborators` and the deprecated `collaborators.baseCollaborators`
- **THEN** exactly one row SHALL exist for that principal with `scope='individual_base'`

#### Scenario: Interface collaborator ingested

- **WHEN** a capture's `interfaces` map contains a page bundle with an `individualCollaborators` entry
- **THEN** a row SHALL exist with `scope='individual_interface'` and `interface_id` set to the page-bundle id

### Requirement: Run-over-run revocation diffing

Each capture SHALL be treated as the complete current access state for its base: observed rows are upserted with bumped last-seen stamps (permission-level changes update in place), `active` rows for that base absent from the capture SHALL be marked `deleted`, and previously `deleted` rows that reappear SHALL be resurrected to `active`. The same semantics apply to invite links.

#### Scenario: Collaborator removed in Airtable

- **WHEN** a principal present in the prior capture is absent from a successful new capture
- **THEN** its row SHALL be marked `status='deleted'` with the run stamp

#### Scenario: Permission level changed

- **WHEN** a principal reappears with a different `permissionLevel`
- **THEN** the row SHALL be updated in place to the new level and remain `active`

### Requirement: Base registry enrichment and raw retention

From each capture, the engine SHALL stamp the base's `workspaceId`, its Airtable `createdTime`, and the token's own `permissionLevel` onto the base's registry row, and SHALL retain the un-modeled blocks (`packages`, and the raw payload) on the capture record for future ingestion.

#### Scenario: Workspace id stamped

- **WHEN** a capture arrives for a base whose registry row has no workspace id
- **THEN** the registry row SHALL carry the capture's `workspaceId` afterward

### Requirement: Best-effort capture posture

A failed metadata fetch for a base SHALL mark the collaborator step `skipped(reason)` in run progress without failing the run, and SHALL NOT trigger deletion diffing for that base (absence of a capture is not evidence of revocation).

#### Scenario: Metadata call fails for one base

- **WHEN** the metadata endpoint returns an error for one base in a run
- **THEN** that base's existing collaborator rows SHALL be untouched and the run SHALL continue
