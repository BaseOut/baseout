# Implementation tasks — server-attachment-upload-status

> **Pairs with** [`workflows-attachment-upload-status`](../workflows-attachment-upload-status/tasks.md). Ship **this** change first — its `/lookup` response shape and `/record` request shape gate the workflows side. Follows [`server-attachments`](../server-attachments/tasks.md), which landed the base table + endpoints.

## Phase 1 — Schema + migration

- [x] 1.1 Add `filename`, `uploadStatus` (`.notNull().default("uploaded")`), `uploadedAt` to `attachmentDedup` in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) (canonical writer).
- [x] 1.2 Author migration `apps/web/drizzle/0014_attachment_upload_status.sql` — three additive `ALTER TABLE baseout.attachment_dedup ADD COLUMN …` per design.md.
- [x] 1.3 Apply via `pnpm --filter @baseout/web db:migrate`; verify clean with `pnpm --filter @baseout/web db:check`.
- [x] 1.4 Mirror the three columns in [apps/server/src/db/schema/attachment-dedup.ts](../../../apps/server/src/db/schema/attachment-dedup.ts) (header already names the canonical migration; add `0014` reference).

## Phase 2 — Endpoint extensions (TDD)

- [x] 2.1 **Red** — extend [apps/server/tests/integration/attachments-lookup-route.test.ts](../../../apps/server/tests/integration/attachments-lookup-route.test.ts): record persists `filename` + `uploadStatus`; `uploaded` sets `uploaded_at`, `ready` leaves it null; lookup returns `{ storageKey, uploadStatus }`; legacy row reads back `'uploaded'`; malformed `uploadStatus` → 400.
- [x] 2.2 **Green** — in [apps/server/src/pages/api/internal/attachments/lookup.ts](../../../apps/server/src/pages/api/internal/attachments/lookup.ts): extend `RecordEntry` + `isRecordEntry` (validate the enum); write `filename` / `uploadStatus` / `uploadedAt` on insert and `onConflictDoUpdate`; change the lookup `hits` value to `{ storageKey, uploadStatus }`.

## Phase 3 — Verification

- [x] 3.1 `pnpm --filter @baseout/server test attachments-lookup-route` green.
- [x] 3.2 `pnpm --filter @baseout/server typecheck` green.
- [x] 3.3 Hand off the `/lookup` + `/record` shapes to [`workflows-attachment-upload-status`](../workflows-attachment-upload-status/tasks.md).
