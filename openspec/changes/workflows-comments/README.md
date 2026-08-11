# workflows-comments — spike results (task 1.1)

**Run 2026-07-27 against `api.airtable.com`** (dev Connection `d0374502…`, token via
the dev engine's ConnectionDO token route). Script: [`spike.mjs`](spike.mjs).

## Verdict: `recordMetadata=commentCount` VERIFIED — Decision 1's primary path works

### Param name/shape

All three encodings are accepted on `GET /v0/{baseId}/{tableId}` (HTTP 200):

- `recordMetadata=commentCount`
- `recordMetadata[]=commentCount`
- `recordMetadata%5B%5D=commentCount`

Use the array form (`recordMetadata[]=commentCount`) — it matches the documented
array type and composes with future metadata keys.

### Listing-entry shape

With the param, **every** record row gains a top-level `commentCount` (present even
when `0` — no need to treat absence as zero):

```jsonc
// GET /v0/app…/tbl…?recordMetadata[]=commentCount&pageSize=100
{
  "records": [
    { "id": "recXXXXXXXXXXXXXX", "createdTime": "2026-03-10T18:11:22.000Z",
      "commentCount": 0, "fields": { /* … */ } }
  ],
  "offset": "…" // normal pagination, unaffected by the param
}
```

Pagination interaction: clean — `pageSize=100` + `offset` cursor behave identically
with and without the param (verified across 4 tables / 25 records). No streaming
surprises: the param just widens each record entry.

### Comments endpoint (capture side)

`GET /v0/{baseId}/{tableId}/{recordId}/comments` → HTTP 200 with the standard grant
(`data.recordComments:read` is already in it — no re-consent):

```jsonc
{ "comments": [], "offset": null }
```

**Populated fixture still pending:** no record in any dev base carries a comment, and
the grant is read-only for comments — a REST `POST …/comments` probe returned 403
(`INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`), correctly: the backup product holds
`data.recordComments:read`, not `:write`. **Human step:** add one comment in the
Airtable UI (e.g. base `flashcards`, record `rec7vu1m9EGfgJrEj`), re-run `spike.mjs`,
and paste the scrubbed populated envelope here (author shape, timestamps, reactions/
mentions raw fields — the `bo_at_comments` column mapping wants them).

### MCP side note

The MCP inventory includes `list_record_comments` (and `create_record_comment`), but
this change deliberately stays on REST (design Decision 1) — the REST endpoint is
verified, paginated, and needs no MCP handshake per record.

## Impact

- Decision 1's primary path (commentCount on the listing pass) is real — the
  full-sweep fallback remains documented but should not be needed.
- Count-delta planning (Decision 1b / `comments-plan`) rests on exactly this
  `commentCount` field — confirmed present and zero-inclusive, so the "observed
  commented subset" is cheap to collect.
- Build remains gated on task 0.1 (PRD/Features amendment + tier decision — drafted
  2026-07-27, pending Dan's tier confirmation).

## Build notes (2026-07-27 — tasks 2.x / 3.x)

**Fan-out strategy as built** (`apps/workflows/trigger/tasks/backup-base.ts`
step 5b + `runCommentCapture`, helper in `_lib/record-comments.ts`):

1. The EXISTING record-listing pass adds `recordMetadata[]=commentCount` (array
   form, per the spike) only when the payload carries `commentsEnabled: true`
   AND the run is full (schema-only runs have no listing pass) AND the
   comments-sync dep is wired. Observed `{recordId, tableId, commentCount>0}`
   plus the zero-count sightings are collected during the same per-record CSV
   pass — no second listing.
2. After the whole table loop (records + attachments done — Decision 3), the
   observed counts POST to `comments-plan`. 409/501 → `skipped(space_db_not_ready)`
   (comments-sync would fail identically; zero fetches). A plan THROW →
   full-refresh fallback over every observed commented record.
3. Fetches run only for the plan's `refresh` list, through
   `fetchRecordComments` (offset pagination; airtable-client pacing: 3 attempts
   on 429/5xx, Retry-After honored). ZeroCandidates observed at count 0 ride the
   FIRST comments-sync batch as `{complete: true, comments: []}` — no fetch;
   unobserved candidates are ignored.
4. Batches flush at 50 records / 500 comments. `complete: true` only for
   records whose pagination finished; a mid-fan-out failure flushes the
   finished records best-effort and reports `partial{reason}` with
   delivered-only counts. No comment failure mode touches the run outcome.

**Fallback ceiling: not shipped, not needed** — the spike verified
`commentCount` is available and zero-inclusive on the standard listing, so
Decision 1's fallback (full per-record sweep + record-count ceiling +
`skipped(too_large)`) was never built. If Airtable ever drops the metadata
param, that fallback design remains documented in design.md Decision 1.

**Incremental runs**: deliberately NOT wired (tasks.md 3.5) — full-backup task
only; `incremental-backup.ts` belongs to the in-flight incremental changes and
the server's per-record `complete` rule keeps unvisited records safe meanwhile.
