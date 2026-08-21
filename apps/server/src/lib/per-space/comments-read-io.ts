// I/O layer for the Data ▸ Comments read route (server-comments-read). Executes
// the pure builders in comments-read.ts against the per-Space `bo_at_comments`
// table. The SQL shapes (filter, keyset, order-by) are rendered-SQL unit-tested
// in comments-read.test.ts; live-PG behaviour rides the manual smoke, exactly as
// records-list does (record-read-io.ts).

import { sql } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'
import {
  buildCommentsWhere,
  commentsKeysetAfter,
  commentsOrderBy,
  commentCursorFor,
  encodeCommentsCursor,
  mapCommentRow,
  type CommentDbRow,
  type CommentWireRow,
  type CommentsCursor,
  type CommentsFilters,
} from './comments-read'

// Exact count is reported up to this cap; beyond it total is `approximate`
// (mirrors record-read-io's APPROX_COUNT_CAP).
const APPROX_COUNT_CAP = 50_000

export interface CommentsPage {
  comments: CommentWireRow[]
  nextCursor: string | null
  total: number
  approximate: boolean
}

export interface QueryCommentsArgs {
  filters: CommentsFilters
  cursor: CommentsCursor | null
  limit: number
}

async function approxTotal(
  tx: SpaceTx,
  filterPred: ReturnType<typeof buildCommentsWhere>,
): Promise<{ count: number; approximate: boolean }> {
  const whereClause = filterPred ? sql`where ${filterPred}` : sql``
  const rows = (await tx.execute(sql`
    select count(*)::int as c from (
      select 1 from bo_at_comments ${whereClause} limit ${APPROX_COUNT_CAP + 1}
    ) s
  `)) as unknown as Iterable<{ c: number }>
  const first = [...rows][0]
  const c = Number(first?.c ?? 0)
  return c > APPROX_COUNT_CAP
    ? { count: APPROX_COUNT_CAP, approximate: true }
    : { count: c, approximate: false }
}

export async function queryCommentsPage(
  tx: SpaceTx,
  args: QueryCommentsArgs,
): Promise<CommentsPage> {
  const filterPred = buildCommentsWhere(args.filters)
  const after = commentsKeysetAfter(args.cursor)

  const whereParts = []
  if (filterPred) whereParts.push(filterPred)
  if (after) whereParts.push(after)
  const where =
    whereParts.length > 0 ? whereParts.reduce((acc, p) => sql`${acc} and ${p}`) : sql`true`

  const take = args.limit + 1
  const rows = (await tx.execute(sql`
    select
      airtable_comment_id, airtable_record_id, airtable_table_id, base_id,
      author, text, airtable_created_at, airtable_last_updated_at,
      last_seen_at, status, raw
    from bo_at_comments
    where ${where}
    order by ${commentsOrderBy()}
    limit ${take}
  `)) as unknown as Iterable<CommentDbRow>

  const page = [...rows]
  let nextCursor: string | null = null
  if (page.length > args.limit) {
    page.length = args.limit
    nextCursor = encodeCommentsCursor(commentCursorFor(mapCommentRow(page[page.length - 1]!)))
  }

  const total = await approxTotal(tx, filterPred)

  return {
    comments: page.map(mapCommentRow),
    nextCursor,
    total: total.count,
    approximate: total.approximate,
  }
}
