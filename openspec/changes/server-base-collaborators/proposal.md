# server-base-collaborators — Proposal

## Why

Who can touch a base — and at what permission level, granted by whom, since when — is core schema/data intelligence that Baseout doesn't capture today. Airtable's `GET /v0/meta/bases/{baseId}` endpoint (with `include=collaborators,inviteLinks,interfaces,packages`) exposes it on **every billing plan**, to any caller with base read-only access, under a scope the OAuth grant already includes (`schema.bases:read`) — no re-consent, no enterprise gate. It also returns the base's `workspaceId`, its `createdTime`, and our own token's effective `permissionLevel` — metadata the platform wants anyway (2026-07-29 founder direction).

## What Changes

- **New per-Space table `bo_at_collaborators`** (all three schema mirrors): one row per principal per scope — `scope` enum `individual_base | individual_workspace | group_base | group_workspace | individual_interface | group_interface`, `permission_level`, `email` + `user_id` (individual scopes), `group_id` + `group_name` (group scopes), `granted_by_user_id`, `airtable_created_time`, `base_id`, `interface_id` (interface scopes only), lifecycle `status` (`active`/`deleted`), first/last-seen stamps. The API's top-level `collaborators` block is **deprecated by Airtable's own docs** in favor of `individualCollaborators`/`groupCollaborators` — ingestion reads the canonical blocks, with the deprecated block as a fallback source mapped to the `individual_*` scopes (design Decision 2).
- **New per-Space table `bo_at_invite_links`**: outstanding invite links are a live security surface (an unexpired multi-use edit link is an open door) — `airtable_invite_id`, `link_scope` (`base`/`workspace`/`interface`), `invited_email`, `permission_level`, `referred_by_user_id`, `restricted_to_email_domains`, `type` (`singleUse`/`multiUse`), timestamps, lifecycle + seen stamps.
- **New internal route `POST /api/internal/spaces/collaborators-sync`** (INTERNAL_TOKEN-gated, comments-sync pattern): accepts the per-base metadata capture from the workflows task, upserts both tables, and diffs run-over-run — principals/links absent from a successful re-capture are marked `deleted` (access-revocation visibility, the same value the record diff provides).
- **Base registry enrichment:** the capture's `workspaceId`, base `createdTime`, and our token's `permissionLevel` are stamped onto the base's registry row; the `packages` block (shape not yet pinned) and the raw payload are retained for future ingestion.
- **Capture half is the paired [`workflows-base-collaborators`](../workflows-base-collaborators/proposal.md)** — one extra GET per base per backup run, alongside the existing `getBaseSchema()` fetch. Land this change first (owns the contract).

**Scope flag** (per CLAUDE.md §1): collaborator/invite-link capture appears in the v1.1 PRD only under the Governance umbrella (V2-flagged). This spec is filed at founder direction; the PRD/Features amendment must name the entity rows and tier. Recommendation in the design: capture-and-store rides record backup (it's base metadata, one cheap call); *surfacing* it (governance UI, audit alerts) stays V2.

## Capabilities

### New Capabilities

- `collaborator-registry`: per-Space persistence and lifecycle of base/workspace/interface collaborators and outstanding invite links from the base-metadata endpoint, with run-over-run revocation diffing, base-registry enrichment (workspaceId, createdTime, own permissionLevel), and raw-payload retention for not-yet-ingested blocks (packages).

### Modified Capabilities

None.

## Impact

- **App:** `apps/server` — new internal route + pure sync/diff module + per-Space migration (sequenced atop `system-per-space-db`).
- **Package:** `packages/db-schema` — two new tables in `space/{sqlite,pg,pg-ddl}.ts`.
- **Cross-repo contract:** the collaborators-sync request body is owned by THIS change's spec; `workflows-base-collaborators` consumes it.
- **No new secrets. No OAuth scope change** (`schema.bases:read` already granted). **No master-DB schema change** beyond the registry-row stamps if those columns don't already exist (design confirms).
- **Blockers:** PRD/Features amendment (entity rows + tier); per-Space migration sequencing.
