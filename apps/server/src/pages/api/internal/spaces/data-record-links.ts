// GET /api/internal/spaces/:spaceId/data/records/:recordId/links/:fieldId
//
// Linked-record expansion for the Data browser (server-data-browse Task 3.2b).
// Hydrates the records a link cell points to — primary-field display + a few
// preview values — keyset-paged over the id list itself (so a 10k-link cell
// never hydrates at once) and searchable within the linked set. Query params:
//   - cursor: the last linked record id from a prior page's nextCursor
//   - limit:  page size, clamped to [1, 200]
//   - q:      ILIKE search on the linked table's primary field, within the set
// Response: { ok, links:[{recordId, primaryValue, preview, missing?}],
//             nextCursor, total }. Dangling ids (deleted/absent linked records)
// return as { recordId, missing: true } rather than being dropped.
// Managed_pg only (per-Space read path 501s on other backends). Token gate is
// applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { clampPageSize } from '../../../../lib/per-space/record-read'
import { expandLinkedSet } from '../../../../lib/per-space/record-provenance-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataRecordLinksHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  recordId: string,
  fieldId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)
  if (!recordId) return jsonResponse({ error: 'invalid_request', param: 'recordId' }, 400)
  if (!fieldId) return jsonResponse({ error: 'invalid_request', param: 'fieldId' }, 400)

  const sp = new URL(request.url).searchParams
  const limit = clampPageSize(sp.get('limit'))
  const cursor = sp.get('cursor')
  const rawQ = sp.get('q')
  const q = rawQ && rawQ.trim() ? rawQ.trim() : null

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      expandLinkedSet(tx, { recordId, fieldId, cursor, limit, q }),
    )
    if (result.status === 'field_not_found') return jsonResponse({ error: 'field_not_found' }, 404)
    if (result.status === 'not_linkable') return jsonResponse({ error: 'field_not_linkable' }, 400)
    logIfSlow('data/record-links', started, { spaceId, recordId, fieldId, rows: result.links.length })
    return jsonResponse({ ok: true, links: result.links, nextCursor: result.nextCursor, total: result.total }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
