/**
 * GET /api/spaces/:spaceId/data/media/totals[?class&baseId&tableId&minSize&maxSize&after&before]
 * Data ▸ Attachments totals proxy (count + summed size for the current filter).
 * Authenticated + IDOR- and tier-gated (Schema Docs level). 501 for non-`managed_pg`.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetMediaTotalsResult, type MediaQuery } from '../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../../../lib/capabilities/tier-capabilities'
import { parseMediaQuery } from '../media'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface DataMediaTotalsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  query: MediaQuery
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, query?: MediaQuery) => Promise<GetMediaTotalsResult>) | null
}

export async function handleDataMediaTotals(input: DataMediaTotalsRouteInput): Promise<Response> {
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
  return r.ok
    ? jsonResponse({ ok: true, count: r.count, sizeBytes: r.sizeBytes }, 200)
    : jsonResponse({ error: r.code, message: r.message }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: DataMediaTotalsRouteInput['engine'] = null
  if (env.SERVER && env.SERVER_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.SERVER,
      internalToken: env.SERVER_INTERNAL_TOKEN,
    })
    engine = (spaceId, query) => e.getMediaTotals(spaceId, query)
  }
  return handleDataMediaTotals({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    query: parseMediaQuery(new URL(request.url).searchParams),
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
