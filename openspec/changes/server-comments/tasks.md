# Tasks

## 0. Blockers (before implementation)

- [ ] 0.1 PRD §2.9 + Features capability-matrix rows for comment backup exist (entity, collection method = REST API, canonical capability name, tier) — action-plan §6 owns the doc edit; Dan resolves the tier (design Decision 4).

## 1. Contract + schema

- [ ] 1.1 Define the comments-sync request body in `per-space/comments-sync.ts` — single source for both repos: `{ runId, baseId, records: [{ recordId, tableId, complete: true, comments: [...] }] }` (exact comment fields per the workflows spike fixture).
- [ ] 1.2 Per-Space migration: `bo_at_comments` per the design sketch — version bump coordinated with the in-flight `system-per-space-db` sequence.

## 2. Pure module (TDD)

- [ ] 2.1 Extraction/validation of the batch body; malformed-entry leniency.
- [ ] 2.2 Per-record diff: new ids added; edits update text + stamps; ids missing from a `complete` record capture marked deleted; records absent from the batch untouched (design Decision 3).

## 2b. Count-delta plan (pure, TDD)

- [ ] 2b.1 Pure plan module: given observed `{recordId, commentCount}` + stored active counts → `{refresh, zeroCandidates}`; equal counts excluded (documented same-count blind spot per design Decision 5).

## 3. IO + route

- [ ] 3.1 `space-db-pg.ts`: `readCommentWorkingSet(recordIds)` / `applyCommentBatch` / `readActiveCommentCounts(baseId)` (grouped count over `bo_at_comments`, no schema change).
- [ ] 3.2 `POST /api/internal/spaces/comments-sync` route (INTERNAL_TOKEN-gated, per-request masterDb + per-Space DB resolution like records-sync).
- [ ] 3.2b `POST /api/internal/spaces/comments-plan` route (same gating/resolution; wraps 2b.1 + 3.1 counts read).
- [ ] 3.3 Stamp `commentsEnabled` on the backup task payload once 0.1 resolves the tier.
- [ ] 3.4 Integration tests (`tests/integration/per-space/comments-sync.test.ts`): first capture; edit; delete; incremental batch leaves unvisited records untouched; plan returns refresh only for changed counts; zero-drop via empty complete capture; same-count edit produces no refresh (accepted-miss scenario).

## 4. Retention + docs

- [ ] 4.1 Fold `bo_at_comments` into the retention/cleanup deletion plan alongside record rows (`server-retention-and-cleanup` machinery).
- [ ] 4.2 Cross-check body shape with `workflows-comments`; this change lands + deploys to dev FIRST.

## 5. Verification

- [ ] 5.1 Targeted suites + `tsc --noEmit` green.
- [ ] 5.2 Dev E2E with the workflows half: backup run on a base with commented records → `bo_at_comments` rows; edit + delete a comment in Airtable, re-run, see the update + soft delete.
