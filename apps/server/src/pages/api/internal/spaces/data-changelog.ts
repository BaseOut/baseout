// GET /api/internal/spaces/:spaceId/data/changelog
//
// Space-wide record data changelog for the Data browser (server-data-browse Task
// 3.3). Two views, selected by whether a specific run is requested:
//
//   Rollup (default — no `runId`): one row per per-base run with created /
//   updated / deleted record counts, newest-first, keyset-paginated.
//     → { ok, mode:'rollup', runs:[{ runId, startedAt, completedAt,
//          createdCount, updatedCount, deletedCount }], nextCursor }
//
//   Rows (`runId` present): the records affected by that run for one changeType
//   (created | updated | deleted; defaults to `updated`), record_id-ascending,
//   keyset-paginated. `updated` rows also carry `changedFieldIds`.
//     → { ok, mode:'rows', runId, changeType,
//          rows:[{ recordId, tableId, baseId, changeType, createdTime,
//                  modifiedTime, status, changedFieldIds? }], nextCursor }
//
// Query params: baseId, tableId, fieldId (fieldId narrows the `updated` set on
// bo_at_record_updates.field_id), changeType, run range (fromRun/toRun as run
// UUIDs, or from/to as ISO dates on started_at), cursor, limit (clamped ≤ 200).
//
// managed_pg only (per-Space read path 501s on other backends). Token gate is
// applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { decodeCursor } from '../../../../lib/per-space/record-read'
import {
  parseChangelogRequest,
  queryChangelogRollup,
  queryChangelogRows,
} from '../../../../lib/per-space/record-changelog-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataChangelogHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)

  const sp = new URL(request.url).searchParams

  const parsed = parseChangelogRequest(sp)
  if (parsed.errors.length > 0) {
    return jsonResponse({ error: 'invalid_request', messages: parsed.errors }, 400)
  }

  const cursorParam = sp.get('cursor')
  const cursor = cursorParam ? decodeCursor(cursorParam) : null
  if (cursorParam && !cursor) return jsonResponse({ error: 'invalid_request', param: 'cursor' }, 400)

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    if (parsed.mode === 'rows') {
      const changeType = parsed.changeType ?? 'updated'
      const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        queryChangelogRows(tx, {
          runId: parsed.runId!,
          changeType,
          filters: parsed.filters,
          cursor,
          limit: parsed.limit,
        }),
      )
      logIfSlow('data/changelog', started, { spaceId, mode: 'rows', changeType, rows: result.rows.length })
      return jsonResponse(
        { ok: true, mode: 'rows', runId: parsed.runId, changeType, ...result },
        200,
      )
    }

    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      queryChangelogRollup(tx, { filters: parsed.filters, cursor, limit: parsed.limit }),
    )
    logIfSlow('data/changelog', started, { spaceId, mode: 'rollup', runs: result.runs.length })
    return jsonResponse({ ok: true, mode: 'rollup', ...result }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
