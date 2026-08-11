# server-comments — Proposal

## Why

Record comments are customer-authored content that exists nowhere but Airtable: delete the record (or lose the base) and the discussion thread is gone. The Jul 24 sync committed to speccing comment backup (see [shared/internal/action-plan-2026-07-24.md](../../../shared/internal/action-plan-2026-07-24.md) §2). Unlike Automations/Interfaces, comments ARE exposed by Airtable's REST API (per-record comments endpoint), and Baseout's OAuth grant **already includes `data.recordComments:read`** ([apps/web/src/lib/airtable/config.ts](../../../apps/web/src/lib/airtable/config.ts)) — every existing Connection can read comments today with no re-consent.

**Scope conflict to flag** (per CLAUDE.md §1): comment backup appears nowhere in the v1.1 scope-locked PRD or the Features capability matrix. This pair is filed as the spec for the committed meeting decision, but the weekend PRD/Features update (action-plan §6) must add the entity row (collection method: REST API) and a canonical capability name + tier before implementation starts. **Tier gating is an open question for Dan** — recommendation in the design is to ride the record-backup tier (comments are record data), not a new gate.

## What Changes

- **New internal route `POST /api/internal/spaces/comments-sync`** (INTERNAL_TOKEN-gated, like records-sync): accepts batched comment captures from the workflows task — per record: record id, table id, and the comment list (comment id, author, text, created/last-updated timestamps, raw payload for reactions/mentions).
- **New internal route `POST /api/internal/spaces/comments-plan`** (count-delta skip — added 2026-07-25, founder direction): before any comment fetch, workflows submits the per-record `commentCount`s observed on the record-listing pass; the engine compares each against its stored active-comment count (derived from `bo_at_comments` — **no new column or table**) and returns (a) `refresh`: records whose count changed and need a comment fetch, and (b) `zeroCandidates`: records with stored active comments that no longer appear in the observed commented set. Records with an **unchanged count are skipped entirely** — no comments-endpoint call, no row churn. **Documented blind spot (accepted trade-off):** same-count modifications are not detected until the record's count next changes — this covers the rare delete-one-add-one case AND comment **edits** (an edit never changes the count). Deleted/edited visibility therefore becomes eventual rather than per-run; see design Decision 5 for the optional periodic-full-refresh mitigation (backlog, not built).
- **Persistence:** comments land in a new per-Space table **`bo_at_comments`** (keyed by Airtable comment id, FK-ish reference to record id + table id, author identity, text, timestamps, lifecycle stamps) via a per-Space schema-version bump — **sequenced atop the in-flight `system-per-space-db` work**.
- **Lifecycle/diffing:** run-over-run comparison per record: new comment ids are added, edited comments (text/last-updated delta) are versioned or updated (design decision), and comment ids absent from a successful re-capture of that record are marked deleted — giving deleted-comment visibility, the same value the record diff provides.
- **Retention:** comment rows follow the same retention/cleanup rules as record backups (`server-retention-and-cleanup`) — no separate policy.
- **No web UI in this change.** A follow-up web change (comments on the record detail / Browse surface) is expected once rows exist; noted, not built.

## Capabilities

### New Capabilities

- `comments-sync`: engine-side persistence and lifecycle of REST-captured record comments into `bo_at_comments` via a batched internal route, with deleted-comment visibility and record-aligned retention.

### Modified Capabilities

None.

## Impact

- **App:** `apps/server` — new internal route + `per-space/comments-sync.ts` (pure) + `space-db-pg.ts` IO + per-Space migration. Payload/tier flag (`commentsEnabled`) stamped on the backup task payload once the tier question resolves.
- **Cross-repo contract:** the comments-sync request body — shape owned by THIS change's spec; [`workflows-comments`](../workflows-comments/proposal.md) consumes it. Land this change first.
- **No new secrets. No master-DB schema change. No OAuth scope change** (already granted).
- **Blockers:** PRD/Features amendment (entity row + tier) before implementation; per-Space migration sequencing behind `system-per-space-db`.
