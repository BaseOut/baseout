# server-comment-attachments — Tasks

## 1. Fixtures (shape confirmed from API docs — see design.md payload table)

- [ ] 1.1 In a dev base, create record comments carrying attachments; capture live list-comments payloads as test fixtures confirming the documented `attachments[]` shape (id, filename, url, optional type/size/width/height/thumbnails)
- [ ] 1.2 While capturing: check whether an attachment-only comment edit bumps `lastUpdatedTime` / `commentCount` (design open question); record the answer in design.md — if invisible to count-delta, document as an accepted blind spot alongside the same-count edit case

## 2. Schema (packages/db-schema)

- [ ] 2.1 Add `bo_at_comment_attachments` to `space/sqlite.ts`, `space/pg.ts`, and `space/pg-ddl.ts` per the registry-table requirement (unique on comment id + attachment id; upload_status default `pending`; lifecycle status default `active`)
- [ ] 2.2 Per-Space schema-version bump + migration, sequenced atop `system-per-space-db` (same mechanics as the `bo_at_comments` migration)

## 3. Extraction in comments-sync (apps/server)

- [ ] 3.1 Test-first: pure extraction module parsing attachment references from a comment payload (fixtures from 1.1), including the no-attachments and malformed-payload cases
- [ ] 3.2 Wire extraction into comments-sync persistence: idempotent upsert with `pending` status, no regression of `ready`/`uploaded` rows, gated on `commentsEnabled`
- [ ] 3.3 Widen the comments-sync response with the pending set (`commentAttachmentId`, `commentId`, `recordId`, `url`, `filename`); update the route's contract tests

## 4. Registry endpoints (apps/server)

- [ ] 4.1 Test-first: `/api/internal/attachments/lookup` accepts `source:'comment'` entries served from `bo_at_comment_attachments` (hit carries `{storageKey, uploadStatus}`, bumps `last_seen_at`; sourceless entries unchanged; invalid source → 400)
- [ ] 4.2 Test-first: `/api/internal/attachments/record` accepts `source:'comment'` upserts with the existing `ready`/`uploaded` semantics and `uploaded_at` stamping

## 5. Lifecycle + recovery (apps/server)

- [ ] 5.1 Comment-diff lifecycle marks attachment rows `deleted` when the parent comment is deleted or the attachment disappears from a re-captured comment (bytes retained)
- [ ] 5.2 `comments-plan` includes records with active non-`uploaded` comment-attachment rows in the `refresh` set regardless of count delta; test the stuck-pending recovery scenario end-to-end at the route level

## 6. Close out

- [ ] 6.1 Integration test: sync a fixture capture → pending rows + pending set in response → record uploads → rows `uploaded`; re-sync same capture → no duplicates
- [ ] 6.2 Update `openspec/specs/backup-attachments/spec.md` cross-references if endpoint docs live elsewhere (grep for route docs); confirm `pnpm openspec:changes server` lists this change green
- [ ] 6.3 Flag to Dan: PRD/Features amendment must name comment attachments inside the comments entity row (rides the server-comments blocker); hand the storage-layout contract (`attachments/comments/<commentId>/`) to `workflows-comment-attachments`
