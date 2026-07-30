# workflows-comment-attachments — Tasks

## 1. Contract fixtures (blocked on server pair's spike)

- [ ] 1.1 Pin the pending-set response shape from `server-comment-attachments` as a shared fixture (`commentAttachmentId`, `commentId`, `recordId`, `url`, `filename`); contract-shape test against the server spec

## 2. Adapter (apps/workflows/_lib)

- [ ] 2.1 Test-first: `comment-attachments.ts` adapter mapping pending entries to downloader work items — comment-scoped lookup key (`source:'comment'`), output path `attachments/comments/<commentId>/<filename>`, filename-collision disambiguation with attachment id
- [ ] 2.2 Test-first: `uploadStatus`-from-`storageType` stamping matches the field-attachment convention (`ready` for `local_fs`, `uploaded` for R2/BYOS)

## 3. Task orchestration (backup-base)

- [ ] 3.1 Thread each comments-sync response's pending set into the shared downloader pool, interleaved per batch (not end-of-run), gated on `commentsEnabled`
- [ ] 3.2 Priority: comment items scheduled ahead of queued field-attachment backlog within the shared pool; test with a saturated fake pool
- [ ] 3.3 Failure isolation: 4xx/expired downloads counted `failed`, no record call, run unaffected; progress detail reports `commentAttachments: {downloaded, skipped, failed}`

## 4. Close out

- [ ] 4.1 End-to-end task test with fakes: sync response with pending set → downloads → comment-scoped record calls → progress counts; lookup-hit skip path; flag-off path (zero calls)
- [ ] 4.2 Verify no `cloudflare:workers` imports and type-only task exports remain intact (`pnpm --filter @baseout/workflows test` + typecheck green)
