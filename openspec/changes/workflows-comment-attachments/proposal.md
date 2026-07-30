# workflows-comment-attachments — Proposal

## Why

Comments captured by `workflows-comments` can carry attachments whose URLs expire 2 hours after Airtable issues them (per API docs) — if the bytes aren't downloaded in the same run that observes the comment, they're gone until the next re-fetch (and permanently gone with the base). The paired [`server-comment-attachments`](../server-comment-attachments/proposal.md) registers discovered comment attachments (`pending`) and returns them in the comments-sync response; this change makes the backup task actually fetch and store the bytes.

## What Changes

- The `backup-base` task's comment capture step consumes the **pending set** now returned by `comments-sync` (per entry: `commentAttachmentId`, `commentId`, `recordId`, `url`, `filename`) and feeds it to the existing attachment downloader **within the same run**, while the URLs are live.
- Downloads reuse the established downloader flow with the **comment-scoped registry contract**: `lookup` with `source:'comment'` (skip on hit), download misses, write via the active storage writer, `record` with `source:'comment'` and the `ready`/`uploaded` status reflecting the writer's `storageType` — identical semantics to field attachments.
- **Storage layout:** bytes land under `attachments/comments/<commentId>/<filename>` in the base output (contract owned by the server change), for managed R2 and every BYOS provider alike.
- **Failure isolation matches comment capture:** comment-attachment download is best-effort — a failed or expired-URL download leaves the registry row `pending` (the server change's comments-plan recovery re-fetches it next run) and NEVER fails the backup run.
- Gated by the same `commentsEnabled` payload flag as comment capture — no separate gate.

## Capabilities

### New Capabilities

- `comment-attachment-capture`: in-run download and storage of comment attachments from the comments-sync pending set, using the comment-scoped registry contract, the `attachments/comments/` layout, and best-effort failure isolation.

### Modified Capabilities

None (endpoint and table contracts are owned by `server-comment-attachments`; the comments capture flow itself is unchanged apart from consuming the widened response).

## Impact

- **App:** `apps/workflows` only — `backup-base` orchestration threading the pending set into the downloader, a small comment-attachment adapter in `_lib/`, and tests (plain Vitest, injected `fetchImpl`/writer fakes, fixtures shared with the server change's spike).
- **Cross-repo contract (consumed, not owned):** widened comments-sync response; comment-scoped `lookup`/`record` shapes; `attachments/comments/<commentId>/` layout.
- **Sequencing:** land after `server-comment-attachments` (same order as server-comments → workflows-comments). Blocked with it on the payload-shape spike and the PRD/Features comments amendment.
- No new secrets, scopes, or env vars.
