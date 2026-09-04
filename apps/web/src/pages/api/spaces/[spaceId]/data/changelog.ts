/**
 * GET /api/spaces/:spaceId/data/changelog[?runId&changeType&baseId&tableId&fieldId&cursor&limit&from&to&fromRun&toRun]
 * Data ▸ Changelog proxy (web-data-page / server-data-browse). Rollup (per-run
 * counts) by default; per-run affected-record rows when `runId` is present.
 * Authenticated + IDOR- and tier-gated (Schema Docs level). 501 for non-`managed_pg`.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetDataChangelogResult, type DataChangelogQuery } from '../../../../../lib/backup-engine'
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

export interface DataChangelogRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  query: DataChangelogQuery
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, query?: DataChangelogQuery) => Promise<GetDataChangelogResult>) | null
}

export async function handleDataChangelog(input: DataChangelogRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(guard.space.id, input.query)
  if (!r.ok) return jsonResponse({ error: r.code, message: r.message }, schemaDocsErrorStatus(r.code))
  return r.mode === 'rows'
    ? jsonResponse(
        { ok: true, mode: 'rows', runId: r.runId, changeType: r.changeType, rows: r.rows, nextCursor: r.nextCursor },
        200,
      )
    : jsonResponse({ ok: true, mode: 'rollup', runs: r.runs, nextCursor: r.nextCursor }, 200)
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: DataChangelogRouteInput['engine'] = null
  if (env.SERVER && env.SERVER_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.SERVER,
      internalToken: env.SERVER_INTERNAL_TOKEN,
    })
    engine = (spaceId, query) => e.getDataChangelog(spaceId, query)
  }
  const sp = new URL(request.url).searchParams
  const limitRaw = sp.get('limit')
  const query: DataChangelogQuery = {
    runId: sp.get('runId') ?? undefined,
    changeType: sp.get('changeType') ?? undefined,
    baseId: sp.get('baseId') ?? undefined,
    tableId: sp.get('tableId') ?? undefined,
    fieldId: sp.get('fieldId') ?? undefined,
    fromRun: sp.get('fromRun') ?? undefined,
    toRun: sp.get('toRun') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
    limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
  }
  return handleDataChangelog({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    query,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
