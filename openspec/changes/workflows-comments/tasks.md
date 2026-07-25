# Tasks

## 0. Blockers

- [ ] 0.1 PRD/Features amendment + tier decision (shared blocker — see `server-comments` task 0.1).

## 1. Spike

- [ ] 1.1 Against a dev base with commented records: verify `recordMetadata=commentCount` on the list-records call (name, shape, interaction with existing streaming); document the comments endpoint's pagination + page size; record scrubbed fixtures in this change's README.

## 2. Comments client

- [ ] 2.1 `_lib/` helper: `fetchRecordComments({ baseId, tableId, recordId, accessToken })` — pagination loop, typed result, 429/backoff via the existing client pacing.
- [ ] 2.2 Vitest (node, injected `fetchImpl`): single page, multi-page, 429 retry, 4xx/5xx failure shapes.

## 3. Task integration

- [ ] 3.1 Thread `commentsEnabled` through `BackupBaseTaskPayload` + `BackupBaseInput` (default false).
- [ ] 3.2 Record-listing pass collects commented record ids + counts (Decision 1); fan-out sequenced after records/attachments (Decision 3).
- [ ] 3.2b Comments-plan call before the fan-out (Decision 1b): fetch only the `refresh` list; zeroCandidates observed at count 0 sent as empty `complete` captures; plan failure falls back to refreshing all observed commented records.
- [ ] 3.3 Batch POSTs to comments-sync during fan-out with per-record `complete` flags (Decision 2); run-progress `comments` entry per Decision 4 (include skipped-by-plan count).
- [ ] 3.4 Orchestration tests: happy path; unchanged counts make zero comment fetches; zero-drop path makes zero fetches; plan-failure fallback; partial failure mid-fan-out reports `partial` and only complete records were sent as `complete`; below-tier makes zero comment requests; records/attachments unaffected by comment failures.
- [ ] 3.5 Incremental runs: only visited records re-capture comments (coordinate with the in-flight incremental-backup machinery).

## 4. Contract + docs

- [ ] 4.1 Cross-check the batch body against `server-comments` (single source: that change's spec); land server-first.
- [ ] 4.2 README: spike findings, fan-out strategy, fallback ceiling if commentCount is unavailable.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/workflows test` + typecheck green.
- [ ] 5.2 Dev E2E with the server half: base with commented records → rows appear; edit + delete a comment, re-run, see update + soft delete; run wall-clock impact recorded.
