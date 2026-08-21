# server-comments-read — Design

## Approach

Mirror `record-read` / `data-changelog`:

1. **Cursor** — opaque base64url JSON `{c: createdAt|null, i: commentId}`; order `airtable_created_at DESC NULLS LAST, airtable_comment_id DESC`.
2. **Filters** — parameterized `WHERE` on `base_id`, `airtable_table_id`, `status`. Unknown `status` → 400.
3. **Wire row** — map DB columns to `DataCommentRow`; pull `parentCommentId` + `mentioned` defensively from `raw` jsonb.
4. **IO** — `limit+1` page → `nextCursor`; capped approximate `total` (same 50k pattern as records).
5. **Route gates** — method, UUID `spaceId`, filter/cursor validation before DB; `resolveSpaceDb` → 409 inactive / 501 non-managed_pg.

## Security

- Path under `/api/internal/` → existing INTERNAL_TOKEN middleware.
- Parameterized Drizzle `sql` only; no string-concatenated values.
- Web proxy (separate) adds session + IDOR + tier via `guardSchemaDocsRequest`.
