// GET /api/internal/spaces/:spaceId/data/comments
//
// Space-wide keyset-paginated read of captured record comments from
// bo_at_comments (server-comments-read; paired with the server-comments capture
// path that writes bo_at_comments via comments-sync). Newest-first, keyset-
// paginated, with optional baseId / tableId / status (active|deleted) filters:
//   → { ok, comments:[{ commentId, recordId, tableId, baseId, author, text,
//        createdTime, lastUpdatedTime, lastSeenAt, status, parentCommentId,
//        mentioned }], nextCursor, total, approximate }
//
// Query params: baseId, tableId, status, cursor, limit (clamped ≤ 200).
//
// managed_pg only (per-Space read path 501s on other backends), matching the
// sibling data-records / data-changelog routes. Token gate is applied by
// middleware (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { clampPageSize } from '../../../../lib/per-space/record-read'
import {
  decodeCommentsCursor,
  parseCommentsFilters,
} from '../../../../lib/per-space/comments-read'
import { queryCommentsPage } from '../../../../lib/per-space/comments-read-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataCommentsHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)

  const sp = new URL(request.url).searchParams

  const { filters, errors: filterErrors } = parseCommentsFilters(sp)
  if (filterErrors.length > 0) {
    return jsonResponse({ error: 'invalid_request', messages: filterErrors }, 400)
  }

  const cursorParam = sp.get('cursor')
  const cursor = cursorParam ? decodeCommentsCursor(cursorParam) : null
  if (cursorParam && !cursor) return jsonResponse({ error: 'invalid_request', param: 'cursor' }, 400)

  const limit = clampPageSize(sp.get('limit'))

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      queryCommentsPage(tx, { filters, cursor, limit }),
    )
    logIfSlow('data/comments', started, { spaceId, rows: result.comments.length })
    return jsonResponse({ ok: true, ...result }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
