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

## Table sketch (`bo_at_comments`)

id (pk) · airtable_comment_id (unique per space) · airtable_record_id · airtable_table_id · author (jsonb: id/email/name as provided) · text · airtable_created_at · airtable_last_updated_at · raw jsonb (reactions, mentions) · status (active/deleted) · first_seen / last_seen run + timestamp stamps. Indexed by record id for the future read path.

## Open questions

1. Tier (Decision 4) — Dan.
2. Does the comments endpoint paginate with `offset` like records, and what's the per-request comment cap? (Workflows spike 1.1 documents it; affects batch sizing only.)
3. Mentions: payloads may embed user mentions with collaborator ids — store raw now; any rendering/PII considerations belong to the future web change.
