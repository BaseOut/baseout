# workflows-comments — Proposal

## Why

Record comments are the one piece of record-level customer content the backup pipeline drops today: threads live only in Airtable and vanish with the record or the base. The Jul 24 sync committed to speccing comment backup ([shared/internal/action-plan-2026-07-24.md](../../../shared/internal/action-plan-2026-07-24.md) §2). The REST API exposes them (per-record comments endpoint) and the OAuth grant **already includes `data.recordComments:read`** — no scope change, no customer re-consent. This change is the capture half; persistence/diffing is the paired [`server-comments`](../server-comments/proposal.md).

**Scope flag** (per CLAUDE.md §1): comment backup is absent from the v1.1 scope-locked PRD/Features matrix — the amendment (entity row, capability name, tier) is a blocker owned by the weekend spec update (action-plan §6). Tier is an open question for Dan; the server change's design carries the recommendation.

## What Changes

- The `backup-base` Trigger.dev task gains a **comment capture step**: for records identified as having comments, call the Airtable record-comments endpoint (paginated) and POST batches to the engine's new `comments-sync` internal route as the fan-out progresses.
- **Fan-out control is the core design problem.** A naive per-record sweep is O(records) API calls against Airtable's ~5 rps per-base budget (50k records ≈ hours). The design targets `recordMetadata=commentCount` on the existing record-listing pass so only records with `commentCount > 0` are fetched — verified by a spike task before build; fallback strategies documented in the design.
- **Failure isolation:** comment capture is best-effort — errors mark the step `comments: skipped(reason)` (or partial, per design) in run progress and NEVER fail the backup run or delay record/attachment capture beyond its budgeted window.
- **Incremental awareness:** on incremental runs (in-flight `workflows-incremental-view-refresh` / incremental-backup machinery), only changed/visited records get comment re-capture; the server-side per-record `complete` contract makes unvisited records safe (no false deletions).
- Capability-gated by a `commentsEnabled` payload flag (tier per the PRD/Features amendment; stamped by the engine).

## Capabilities

### New Capabilities

- `comment-capture`: per-backup capture of record comments via the Airtable REST comments endpoint, with comment-count-driven fan-out, batched delivery to comments-sync, best-effort failure isolation, and tier gating.

### Modified Capabilities

None (the new engine route is owned by the server change's spec).

## Impact

- **App:** `apps/workflows` only — `backup-base.ts` orchestration + `_lib/comments client` helper + tests (plain Vitest, injected `fetchImpl`).
- **Cross-repo contract:** consumes `POST /api/internal/spaces/comments-sync` — shape owned by [`server-comments`](../server-comments/proposal.md); land server-first.
- **Secrets/config:** none new.
- **Risk:** whether `recordMetadata=commentCount` is available on the list-records call (and its interaction with the existing record streaming) is spike-gated; worst case the feature ships full-sweep for small bases with a record-count ceiling, and the ceiling is a documented product limitation until Airtable offers a better signal.
- **Runtime budget:** comment fan-out extends run wall-clock on comment-heavy bases; the task's `maxDuration` and pacing must be re-checked in the spike (Trigger.dev Node runner has no Worker limit, but runs should stay predictable).
