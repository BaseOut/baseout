# workflows-comments — Design

## Decision 1 — Comment-count-driven fan-out

Request `recordMetadata=commentCount` on the record-listing pass the task already performs, collect `recordId`s with `commentCount > 0`, and fetch comments only for those. Typical bases have comments on a small fraction of records, collapsing the fan-out from O(records) to O(commented records).

**Spike must verify:** the parameter's exact name/behavior on the list endpoint we use, that it doesn't disturb the existing record streaming/CSV path, and the comments endpoint's pagination (`offset`?) + page size.

**Fallbacks if unavailable:** (a) full per-record sweep capped at a record-count ceiling (skip with `skipped(too_large)` above it — documented limitation); (b) comments only on records touched by the current run (incremental signal). Prefer (a)+(b) combined over silently partial data.

## Decision 1b — Count-delta skip via comments-plan (added 2026-07-25, founder direction)

After the listing pass collects `{recordId, tableId, commentCount}` for commented records, the task POSTs them to `POST /api/internal/spaces/comments-plan` and fetches comments only for the returned `refresh` list. For each returned `zeroCandidate` the task actually saw listed with `commentCount = 0`, it sends `{recordId, complete: true, comments: []}` on the first comments-sync batch — deletion resolves through the server's existing per-record rule with no fetch. Candidates not seen in the listing are ignored (unvisited/deleted records — not this feature's job). **Plan-call failure degrades to the pre-optimization behavior** (refresh every observed commented record) — the optimization can only reduce work, never correctness. The task keeps the listing counts in memory for the run; nothing new is persisted workflows-side.

Why this shape: the engine owns the stored state, so it makes the skip decision; workflows sends only the observed-commented subset (small), and the zeroCandidates handshake covers count-to-zero drops without an O(records) payload of zeros.

## Decision 2 — Stream batches to comments-sync during the fan-out

POST comment batches (e.g. every N records or M comments) to `POST /api/internal/spaces/comments-sync` as the fan-out progresses — no buffering a run's worth of comments. Each batch entry carries `complete: true` per record only when that record's pagination finished, so the server's per-record deletion rule stays safe under mid-run failures.

## Decision 3 — Pacing shares the existing per-base budget

Comment requests go through the same Airtable REST client pacing/backoff (429-aware) the record fetch uses, sequenced AFTER records/attachments for the base so the core backup content never queues behind comment chatter. Comment capture failing or timing out reports `skipped(reason)` / `partial` in run progress without touching run outcome (same isolation contract as MCP captures).

## Decision 4 — Progress reporting

Run progress gains a `comments` entry per base: `captured {records, comments}` | `partial {reason}` | `skipped {reason}`. Partial (some records captured, then failure) is reported honestly — the server only acted on records it received with `complete: true`, so partials are consistent, just not exhaustive.

## Open questions

1. Tier (owned by server change design Decision 4 / Dan).
2. `recordMetadata=commentCount` verification (Decision 1 spike).
3. Should schedule-driven runs and manual runs both capture comments, or manual-only at first? Default: both, same flag — no hidden mode split.
