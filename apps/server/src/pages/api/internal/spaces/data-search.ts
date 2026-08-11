// GET /api/internal/spaces/:spaceId/data/search?q=<text>
//
// Cross-base/table search for the Data browser (server-data-browse Task 3.4).
// Scans record field VALUES (ILIKE on record_field_data.value) and field NAMES
// (ILIKE on bo_at_fields.name), collecting flat hits up to a Space-level scan
// budget, then groups them base → table with a per-table cap. If the budget is
// hit the result's `partial` flag is set ("showing first matches"). Query params:
//   - q:       search text (required; empty/whitespace → 400)
//   - baseId:  optional base scope
//   - tableId: optional table scope
// Response: { ok, groups, partial }.
// Managed_pg only (per-Space read path 501s on other backends). Token gate is
// applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { searchRecords } from '../../../../lib/per-space/record-search-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataSearchHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)

  const sp = new URL(request.url).searchParams
  const q = (sp.get('q') ?? '').trim()
  if (!q) return jsonResponse({ error: 'invalid_request', param: 'q' }, 400)
  const baseId = sp.get('baseId')?.trim() || null
  const tableId = sp.get('tableId')?.trim() || null

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      searchRecords(tx, { q, baseId, tableId }),
    )
    logIfSlow('data/search', started, { spaceId, groups: result.groups.length, partial: result.partial })
    return jsonResponse({ ok: true, ...result }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
