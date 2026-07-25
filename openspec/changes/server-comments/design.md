# server-comments — Design

## Decision 1 — Dedicated batched route, not a records-sync extension

Comments arrive on a different cadence and volume profile than record pages (per-record fan-out on the workflows side, potentially many small batches late in a run). A dedicated `POST /api/internal/spaces/comments-sync` keeps the records-sync contract stable (it's load-bearing for the in-flight incremental work) and lets comment batches stream in as the fan-out progresses instead of buffering a run's worth of comments into one records-sync body.

**Rejected:** optional `comments` field on records-sync (couples the two payloads' size budgets and retry semantics); riding schema-sync (comments are data, not schema).

## Decision 2 — Update-in-place with an `edited` changelog-style stamp, not full versioning

`bo_at_comments` stores the current text plus `created_at`/`last_updated_at` from Airtable and our lifecycle stamps. An edited comment updates the row and stamps the run; a comment id absent from a successful re-capture of its record is marked deleted (soft, like the record diff). Full text-version history is rejected for now — comments are chatty, low-stakes text; deleted/edited *visibility* is the product value (matches the deleted-records feature), full history is cheap to add later if asked.

## Decision 3 — Per-record capture sets define deletion scope

Deletion is judged **per record**: only when the workflows task reports a successful, complete comment capture for record X do missing comment ids on X get marked deleted. Records not visited in a run (e.g. incremental runs) leave their comments untouched. This mirrors the "confident full capture" invariant from interface/automation sync, scoped down to the record.

## Decision 4 — Tier recommendation (open for Dan)

Recommend: comments ride the **record-backup tier** (they're record data; a separate gate adds capability-matrix surface for marginal revenue). Alternative: Growth+ alignment with the other "premium entity" backups. Either way the flag is resolved from Stripe metadata per Features §5.5 and stamped as `commentsEnabled` on the task payload. **Do not implement until the Features matrix names the capability** (action-plan §6).

## Decision 5 — Count-delta refresh planning (added 2026-07-25, founder direction)

Re-fetching every commented record's comments on every run wastes the per-base API budget on records whose threads didn't change. Instead, refresh is **planned by count delta**: workflows POSTs the observed `commentCount` per commented record to `comments-plan`; the engine derives each record's stored active-comment count with a grouped count over `bo_at_comments` (indexed by record id — **no schema change**) and returns only the records whose observed count differs (`refresh`). It also returns `zeroCandidates` — records holding stored active comments that are absent from the observed commented set; workflows confirms each candidate it actually saw listed with `commentCount = 0` by sending an empty `complete: true` capture on comments-sync, which flows through the existing per-record deletion rule (Decision 3) with **no comment fetch at all**. Candidates workflows did not see listed (deleted/unvisited records) are left untouched — record-deletion cleanup stays retention's job.

**Accepted blind spot (founder-approved):** a record whose count is unchanged is skipped, so (a) a deletion paired with an addition between runs (rare) and (b) **comment edits** (common enough to note — edits never change the count) go undetected until the count next moves. The founder judged the API-budget saving worth this; it is a documented product behavior, not a bug. Optional mitigation if it ever matters: a periodic full refresh (every Nth run or on manual runs) — backlog note only, do not build now.

**Failure posture:** if the plan call fails, workflows falls back to refreshing **all** observed commented records (the pre-optimization behavior) — the optimization degrades to correctness, never the reverse. Partial captures self-heal: an incomplete capture leaves the stored count wrong, which forces that record into `refresh` on the next run.

**Rejected:** storing a `last_comment_count` column (derivable; would drift from the rows on partial writes); having workflows send counts for *all* records including zeros (O(records) payload for no benefit — the zeroCandidates handshake covers count-to-zero drops with a small response instead).

## Table sketch (`bo_at_comments`)

id (pk) · airtable_comment_id (unique per space) · airtable_record_id · airtable_table_id · author (jsonb: id/email/name as provided) · text · airtable_created_at · airtable_last_updated_at · raw jsonb (reactions, mentions) · status (active/deleted) · first_seen / last_seen run + timestamp stamps. Indexed by record id for the future read path.

## Open questions

1. Tier (Decision 4) — Dan.
2. Does the comments endpoint paginate with `offset` like records, and what's the per-request comment cap? (Workflows spike 1.1 documents it; affects batch sizing only.)
3. Mentions: payloads may embed user mentions with collaborator ids — store raw now; any rendering/PII considerations belong to the future web change.
