# server-base-collaborators — Design

## Context

`GET /v0/meta/bases/{baseId}?include=collaborators&include=inviteLinks&include=interfaces&include=packages` returns, in one unpaginated response: individual + group collaborators at base and workspace level, outstanding invite links (base/workspace), per-interface collaborators and invite links, package installation data, the base's `workspaceId` and `createdTime`, and the calling token's own `permissionLevel`. Auth: `schema.bases:read` (granted) or `workspacesAndBases:read`; minimum role base read-only; all billing plans (verified against the API docs 2026-07-29).

The persistence pattern follows `server-comments`: workflows captures during the backup run, POSTs to an INTERNAL_TOKEN-gated sync route, the engine owns per-Space persistence and run-over-run diffing.

## Payload → schema mapping (confirmed shapes)

Collaborator entry (individual): `{createdTime, email, grantedByUserId, permissionLevel, userId}`. Group entry: `{createdTime, grantedByUserId, groupId, name, permissionLevel}` — **no email/userId**, hence nullable principal columns and a `scope` discriminator rather than separate tables per kind. Interface entries reuse the same shapes under `interfaces.<pageBundleId>.{individualCollaborators, groupCollaborators, inviteLinks}`.

Invite link: `{id, invitedEmail (nullable), permissionLevel, referredByUserId, restrictedToEmailDomains[], type: singleUse|multiUse, createdTime}`.

## Goals / Non-Goals

**Goals:**
- One collaborators table covering all six scopes (`individual|group × base|workspace|interface`), one invite-links table covering three.
- Revocation visibility: a principal or link absent from a successful re-capture is marked `deleted` with the run stamp — the "who lost access when" audit trail.
- Idempotent under retries; deprecated-block fallback that can't double-count.

**Non-Goals:**
- Governance UI, alerting, or permission-change notifications (V2 per PRD; rows exist so V2 has history from day one).
- Enterprise admin endpoints (`enterprise.groups:read` etc.) — this is strictly the plan-agnostic base-metadata call.
- Restore/write-back of collaborators (no write API).

## Decisions

**1. One table, `scope` discriminator — not per-kind tables.**
Six scopes share one lifecycle, one diff algorithm, one sync route. The alternative (separate base/workspace/interface tables) triples the migration and diff surface for zero query benefit; scope + two nullable principal columns (`user_id` vs `group_id`) is the established trade (cf. `bo_at_asset_refs` handling mixed anchors).

**2. Canonical blocks first; deprecated block as fallback only.**
Airtable's docs deprecate top-level `collaborators` in favor of `individualCollaborators`/`groupCollaborators`, and the sample payload shows the deprecated block duplicating the individual entries. Ingestion therefore reads the canonical blocks; entries found **only** in the deprecated block (older payload variants) are ingested with the matching `individual_*` scope. Never both — the unique key `(base_id, interface_id, scope, principal_id)` makes double-ingestion structurally impossible. (`principal_id` = `user_id` for individual scopes, `group_id` for group scopes; `interface_id` empty-string-normalized for non-interface scopes so the unique index works across both SQLite and PG.)

**3. Interface collaborators and invite links are ingested, not skipped.**
The founder flagged interfaces as possibly redundant with MCP capture — the *interface definitions* are (owned by `server-automations-interfaces-docs` / MCP changes), but the **per-interface access lists and invite links are not available via MCP** and are exactly the governance surface this change exists for. Ingest them into the same two tables with `interface_id` set and `*_interface` / `interface` scope values. Interface *definitions* from this payload are not persisted here (no overlap with the MCP-owned capture).

**4. Diff semantics: per-base full-state replace with soft delete.**
Each capture is the complete current state for that base (endpoint is unpaginated). Diff: upsert everything observed (bump last-seen), mark `deleted` any active row for that base not in the capture, resurrect (`active` + stamp) rows that reappear. Same mechanics as comment lifecycle; permission-level *changes* update in place — the row's history is (for now) last-write; an audit-event trail is a V2 follow-up noted in the proposal.

**5. Packages block: retain raw, don't model.**
`packages` shape isn't pinned (docs say "package installation data"); modeling it now is speculation. The sync route stores the raw block (and the base-level extras) on the capture record so ingestion can be added without re-fetching history. Base-registry stamps (`workspace_id`, `airtable_created_time`, `own_permission_level`) go on the existing base registry row — task 2.3 confirms whether the columns exist master-side (`at_bases`) or per-Space and files the delta accordingly.

**6. Capture cadence: every backup run, alongside `getBaseSchema()`.**
One extra GET per base per run is negligible against the existing schema fetch, keeps collaborator freshness aligned with backup frequency (which the customer already chose as their staleness tolerance), and gives the diff a natural run anchor. Alternative rejected: rediscovery-alarm cadence — wrong ownership (rediscovery is workspace-membership, not base-content) and a second, slower staleness clock for no cost saving.

## Risks / Trade-offs

- **[Permission-level history is last-write]** A change from `read` → `owner` overwrites; the trail shows current state + seen stamps only → acceptable for capture-and-store scope; V2 audit events are the fix and the rows carry enough (granted_by, created_time, run stamps) to backfill meaningfully from run history if needed.
- **[Workspace-level rows repeat per base]** A workspace collaborator appears in every base's capture in that workspace → rows are per-base by design (base-centric queries stay trivial); volume is small (collaborator counts are human-scale) and the unique key keeps it one row per base+principal.
- **[Deprecated-block drift]** If Airtable removes the deprecated block, nothing breaks (fallback simply never fires); if canonical blocks are ever absent on old payloads, fallback covers it.
- **[Include-param failures]** A 4xx on the metadata call (e.g. token lacks meta read on a specific base) → capture skipped for that base, `collaborators: skipped(reason)` in run progress, never fails the run — same best-effort posture as comments.

## Migration Plan

Per-Space schema-version bump adding both tables (three mirrors), atop `system-per-space-db`. Additive; rollback = flag off, tables idle.

## Open Questions

- `packages` block shape (retained raw until pinned from a live payload).
- PRD/Features amendment: entity rows + tier for collaborator/invite-link capture (recommendation: capture rides record backup; governance surfacing stays V2). Owner: Dan.
