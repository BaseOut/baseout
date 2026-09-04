/**
 * GET /api/spaces/:spaceId/data/records?tableId=tblXXX[&filters&sort&cursor&limit&fields]
 * Data ▸ Records proxy (web-data-page / server-data-browse). Keyset-paginated
 * record page for one table. Authenticated + IDOR- and tier-gated (Schema Docs
 * level — the same "read your backed-up data" capability family). Returns 501
 * (`backend_not_implemented`) for non-`managed_pg` Spaces — the Data page renders
 * that as its honest "available on managed Postgres Spaces" state.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetDataRecordsResult, type DataRecordsQuery } from '../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../../lib/capabilities/tier-capabilities'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface DataRecordsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  tableId: string | null
  query: DataRecordsQuery
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | ((spaceId: string, tableId: string, query?: DataRecordsQuery) => Promise<GetDataRecordsResult>)
    | null
}

export async function handleDataRecords(input: DataRecordsRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (!input.tableId) return jsonResponse({ error: 'invalid_request', param: 'tableId' }, 400)
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(guard.space.id, input.tableId, input.query)
  return r.ok
    ? jsonResponse(
        {
          ok: true,
          records: r.records,
          nextCursor: r.nextCursor,
          total: r.total,
          approximate: r.approximate,
          filterErrors: r.filterErrors,
        },
        200,
      )
    : jsonResponse({ error: r.code, message: r.message }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: DataRecordsRouteInput['engine'] = null
  if (env.SERVER && env.SERVER_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.SERVER,
      internalToken: env.SERVER_INTERNAL_TOKEN,
    })
    engine = (spaceId, tableId, query) => e.getDataRecords(spaceId, tableId, query)
  }
  const sp = new URL(request.url).searchParams
  const limitRaw = sp.get('limit')
  const query: DataRecordsQuery = {
    filters: sp.get('filters') ?? undefined,
    sort: sp.get('sort') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
    limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
    fields: sp.get('fields') ?? undefined,
  }
  return handleDataRecords({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    tableId: sp.get('tableId'),
    query,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
