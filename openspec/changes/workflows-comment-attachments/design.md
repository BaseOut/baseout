# workflows-comment-attachments — Design

## Context

The `backup-base` task already runs a comment capture step (`workflows-comments`): batched POSTs to `comments-sync` as the record fan-out progresses. The server pair widens that route's response with a pending set of comment attachments carrying live (short-lived) URLs. The task also already owns the attachment downloader used for field attachments: lookup → download misses → storage-writer write → record. This change is plumbing: thread the pending set into that downloader with comment-scoped identity, without letting media work destabilize the comment step's best-effort contract.

## Goals / Non-Goals

**Goals:**
- Download within the same run, as close to the sync response as practical (URL freshness).
- One downloader code path — comment attachments differ only in registry key shape and output folder.
- A failed download degrades to "row stays `pending`" (server-side recovery re-fetches next run), never to a failed run.

**Non-Goals:**
- Extraction/parsing of comment payloads (server-side, per the pair's Decision 2).
- Retry orchestration beyond the run (comments-plan recovery owns that).
- Restore of comment attachments.

## Decisions

**1. Drain pending entries per sync batch, not at end of run.**
Each comments-sync response's pending set is handed to the downloader immediately, interleaved with the remaining capture fan-out. Alternative rejected: accumulate all pending entries and download at the end — simpler sequencing but maximizes URL age against a hard 2-hour expiry window.

**2. Adapter, not a second downloader.**
A `_lib/comment-attachments.ts` adapter maps pending entries to the downloader's work-item shape: comment-scoped lookup key (`source:'comment'`, `airtableCommentId` + `airtableAttachmentId`), output path `attachments/comments/<commentId>/<filename>`, and the same `uploadStatus`-from-`storageType` stamping. The downloader itself stays source-agnostic.

**3. Expired/failed URLs leave the row pending, silently per-item.**
On a 4xx/expired download the item is dropped (row remains `pending` server-side) and counted in the step's progress detail (`commentAttachments: {downloaded, skipped, failed}`); the run and even the comment step never fail for media. This matches the field-attachment "miss tolerance" philosophy and leans on the pair's comments-plan recovery loop.

**4. Concurrency shares the existing attachment budget.**
Comment attachments join the same download concurrency pool and per-base rate budget as field attachments rather than adding a parallel pool — protects the Airtable/provider rate limits that the fan-out design already balances.

## Risks / Trade-offs

- **[Pending set arrives while attachment stage is saturated]** Interleaving could starve comment downloads until URLs expire → items entering the pool carry their issue-time; the adapter prioritizes comment items ahead of field-attachment backlog within the shared pool (small set, negligible impact on field throughput).
- **[Fixture drift]** Parser fixtures live in the server change; the adapter consumes the *response* contract, not raw payloads → contract-shape tests pinned to the server spec's pending-set shape.
- **[Double writes across sources]** Same bytes attached in a field and a comment are written twice (accepted; see pair's Non-Goals — media-index dedup is the future layer).

## Migration Plan

Additive task behavior behind `commentsEnabled`; deploy after the server change. Rollback: feature-flag off returns the task to comments-without-media behavior.

## Open Questions

- None beyond those owned by the server pair (payload-shape spike; PRD/Features amendment).
