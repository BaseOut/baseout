# Tasks

## 0. Blockers (before implementation)

- [x] 0.1 PRD §2.9 + Features capability-matrix rows for comment backup exist (entity, collection method = REST API, canonical capability name, tier) — action-plan §6 owns the doc edit; Dan resolves the tier (design Decision 4). → Doc edits drafted 2026-07-27; **tier CONFIRMED 2026-07-28: rides the record-backup tier** (Features §17 Q18 marked resolved; PRD §2.9 ⚠ removed). Implementation already matched the recommendation — no code change.

## 1. Contract + schema

- [x] 1.1 Define the comments-sync request body in `per-space/comments-sync.ts` — single source for both repos: `{ runId, baseId, records: [{ recordId, tableId, complete: true, comments: [...] }] }` (exact comment fields per the workflows spike fixture). → `CommentsSyncBody` (field is `backupRunId`, matching records-sync) + `CommentsPlanBody`; comment entries forwarded verbatim (id/author/text/createdTime/lastUpdatedTime extracted, whole object kept as `raw`).
- [x] 1.2 Per-Space migration: `bo_at_comments` per the design sketch — version bump coordinated with the in-flight `system-per-space-db` sequence. → v8→v9 (purely additive; idempotent DDL covers existing Spaces — no preUpgradeStatements entry needed); both dialects + regenerated 0000 migrations + pg-ddl.ts; parity tests updated (35 tables) and green. Added `base_id` beyond the sketch — the comments-plan grouped count is per-base.

## 2. Pure module (TDD)

- [x] 2.1 Extraction/validation of the batch body; malformed-entry leniency. → `extractCommentBatch` (drops + counts malformed record/comment entries, never fatal).
- [x] 2.2 Per-record diff: new ids added; edits update text + stamps; ids missing from a `complete` record capture marked deleted; records absent from the batch untouched (design Decision 3). → `diffCommentBatch`; resurrect-on-recapture counts as updated; already-deleted ids never re-deleted.

## 2b. Count-delta plan (pure, TDD)

- [x] 2b.1 Pure plan module: given observed `{recordId, commentCount}` + stored active counts → `{refresh, zeroCandidates}`; equal counts excluded (documented same-count blind spot per design Decision 5). → `planCommentRefresh`; zero stored counts never become zeroCandidates; unseen observed records default stored=0.

## 3. IO + route

- [x] 3.1 `space-db-pg.ts`: `readCommentWorkingSet(recordIds)` / `applyCommentBatch` / `readActiveCommentCounts(baseId)` (grouped count over `bo_at_comments`, no schema change). → done; upsert keyed on the airtable_comment_id unique index; soft delete via status flip.
- [x] 3.2 `POST /api/internal/spaces/comments-sync` route (INTERNAL_TOKEN-gated, per-request masterDb + per-Space DB resolution like records-sync). → registered in index.ts; response reports records/comments/added/updated/deleted/dropped.
- [x] 3.2b `POST /api/internal/spaces/comments-plan` route (same gating/resolution; wraps 2b.1 + 3.1 counts read). → registered; malformed observed entries silently skipped (plan degrades to smaller skip set, never fails the run — workflows falls back on ANY failure).
- [x] 3.3 Stamp `commentsEnabled` on the backup task payload once 0.1 resolves the tier. → stamped via `resolveCommentsEnabled` dep + `lib/capabilities/comment-backup.ts` implementing the RECOMMENDED stance (rides the record-backup tier — every active subscription). Tier confirmed 2026-07-28 (rides the record-backup tier) — stance is final. **Contract extension 2026-07-28:** the webhook-subscriptions `:id/context` route now also stamps `commentsEnabled` (same resolver, failure-isolated to false) so incremental passes gate their visited-record capture (`workflows-comments` task 3.5 pairing).
- [x] 3.4 Integration tests (`tests/integration/per-space/comments-sync.test.ts`): first capture; edit; delete; incremental batch leaves unvisited records untouched; plan returns refresh only for changed counts; zero-drop via empty complete capture; same-count edit produces no refresh (accepted-miss scenario). → 13 tests + 2 commentsEnabled-stamp tests in runs-start.test.ts; all green.

## 4. Retention + docs

- [x] 4.1 Fold `bo_at_comments` into the retention/cleanup deletion plan alongside record rows (`server-retention-and-cleanup` machinery). → NO CODE: the retention plan today deletes run STORAGE PREFIXES only — per-Space record rows (bo_at_records) are the live mirror and are not in the plan, so there is nothing to fold comments into. Requirement satisfied vacuously (comments follow record rows exactly); when record rows ever join a deletion plan, bo_at_comments must join in the same change (note left here).
- [x] 4.2 Cross-check body shape with `workflows-comments`; this change lands + deploys to dev FIRST. → workflows half consumes `CommentsSyncBody`/`CommentsPlanBody` shapes (mirrored types); dev deploy pending human loop.

## 5. Verification

- [x] 5.1 Targeted suites + `tsc --noEmit` green. → comments-sync (13) + runs-start (30) + tsc green 2026-07-27.
- [ ] 5.2 Dev E2E with the workflows half: backup run on a base with commented records → `bo_at_comments` rows; edit + delete a comment in Airtable, re-run, see the update + soft delete.
