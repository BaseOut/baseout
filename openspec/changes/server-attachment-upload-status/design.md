# Design — server-attachment-upload-status

## Schema delta

`attachment_dedup` today (mirror at [apps/server/src/db/schema/attachment-dedup.ts](../../../apps/server/src/db/schema/attachment-dedup.ts), canonical at [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts)):

```
composite_id text PK | space_id text | storage_key text | content_hash text
size_bytes bigint | mime_type text | first_seen_at tz | last_seen_at tz
```

Add:

| column | type | null | default | meaning |
|---|---|---|---|---|
| `filename` | `text` | yes | — | source filename from Airtable |
| `upload_status` | `text` | no | `'uploaded'` | `'ready'` (staged on local disk) \| `'uploaded'` (at managed R2 / BYOS) |
| `uploaded_at` | `timestamptz` | yes | — | set to `now()` when recorded as `uploaded` |

### Migration `apps/web/drizzle/0014_attachment_upload_status.sql`

```sql
ALTER TABLE "baseout"."attachment_dedup" ADD COLUMN "filename" text;
ALTER TABLE "baseout"."attachment_dedup" ADD COLUMN "upload_status" text NOT NULL DEFAULT 'uploaded';
ALTER TABLE "baseout"."attachment_dedup" ADD COLUMN "uploaded_at" timestamp with time zone;
```

`DEFAULT 'uploaded'` is deliberate: every existing row was written directly to a real destination, so the post-migration state is truthful with no backfill. New `local_fs` writes will explicitly record `'ready'`.

### Why a free-text enum, not a Postgres enum type

`storage_key` and the rest of the table already use plain `text`; the codebase validates enums at the route layer (see `isRecordEntry`). Matching that keeps the migration a pure additive `ADD COLUMN` (no type creation, no `ALTER TYPE` rewrites) and avoids a Drizzle enum import churn in both the canonical schema and the mirror. Validation lives in the `/record` handler.

## Endpoint deltas — [lookup.ts](../../../apps/server/src/pages/api/internal/attachments/lookup.ts)

### `/record`

```ts
interface RecordEntry {
  compositeId: string;
  storageKey: string;
  sizeBytes?: number;
  mimeType?: string;
  contentHash?: string;
  filename?: string;                       // NEW
  uploadStatus?: "ready" | "uploaded";     // NEW (validated; default "uploaded")
}
```

`isRecordEntry` rejects an `uploadStatus` that is neither `ready` nor `uploaded`. On insert: write `filename`, `uploadStatus ?? 'uploaded'`, and `uploadedAt = uploadStatus === 'uploaded' ? now() : null`. On conflict: set the same columns from `excluded.*`, keeping `uploaded_at` accurate (set to `now()` when the new status is `uploaded`, otherwise leave/clear per the status).

### `/lookup`

Select `uploadStatus` in addition to `storageKey`. Change the response from:

```ts
hits: Record<string, string>            // compositeId -> storageKey
```

to:

```ts
hits: Record<string, { storageKey: string; uploadStatus: string }>
```

The `last_seen_at` bump on hits is unchanged.

## Consumer impact

This is a breaking shape change to the `/lookup` response, consumed only by the workflows downloader. The paired [`workflows-attachment-upload-status`](../workflows-attachment-upload-status/design.md) change updates the consumer in lockstep; nothing else reads these routes. Ship server first.

## Testing

Extend [attachments-lookup-route.test.ts](../../../apps/server/tests/integration/attachments-lookup-route.test.ts) (real local Postgres + Miniflare bindings per [CLAUDE.md §3.4](../../../CLAUDE.md)):

- record with `uploadStatus: 'ready'` persists `filename`, `upload_status='ready'`, `uploaded_at IS NULL`.
- record with `uploadStatus: 'uploaded'` (or omitted) sets `upload_status='uploaded'`, `uploaded_at` non-null.
- lookup returns `{ storageKey, uploadStatus }` per hit.
- a row inserted before this change (no status) reads back `'uploaded'` (default-backfill check).
- malformed `uploadStatus` → 400.
