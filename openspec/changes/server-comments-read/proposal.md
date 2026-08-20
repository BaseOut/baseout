# server-comments-read — Proposal

## Why

[`server-comments`](../server-comments/proposal.md) captures record comments into per-Space `bo_at_comments` but exposes no read endpoint. The Data ▸ Comments tab client (`getDataComments` / `DataCommentRow`) is already wired on web and needs an engine READ path.

## What Changes

- **`GET /api/internal/spaces/:spaceId/data/comments`** — INTERNAL_TOKEN-gated, keyset-paginated over `bo_at_comments`, newest-first. Optional filters: `baseId`, `tableId`, `status` (`active|deleted`); `cursor` + `limit` (clamped ≤ 200). Response matches web `DataCommentRow` / `GetDataCommentsResult`.
- **managed_pg only** → `501 backend_not_implemented` otherwise (same as `data-records` / `data-changelog`).
- **Pure + IO split**: `comments-read.ts` (cursor codec, filters, parameterized SQL builders, row mapper) + `comments-read-io.ts` (executes against `bo_at_comments`).
- No new table, schema, or OAuth scope. Attachments/reactions out of scope.

## Impact

- `apps/server` — route + pure/IO modules + Vitest.
- Paired web proxy `apps/web/.../data/comments.ts` (this change or follow-up commit).
