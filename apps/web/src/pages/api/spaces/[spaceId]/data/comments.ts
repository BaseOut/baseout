/**
 * GET /api/spaces/:spaceId/data/comments[?baseId&tableId&status&cursor&limit]
 * Data ▸ Comments proxy (web-data-page / server-comments-read). Keyset-paginated
 * space-wide record-comment feed. Authenticated + IDOR- and tier-gated (Schema
 * Docs level — the same "read your backed-up data" capability family as the
 * sibling records/changelog proxies). Returns 501 (`backend_not_implemented`)
 * for non-`managed_pg` Spaces — the Data page renders that as its honest
 * "available on managed Postgres Spaces" state.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetDataCommentsResult, type DataCommentsQuery } from '../../../../../lib/backup-engine'
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

export interface DataCommentsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  query: DataCommentsQuery
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, query?: DataCommentsQuery) => Promise<GetDataCommentsResult>) | null
}

export async function handleDataComments(input: DataCommentsRouteInput): Promise<Response> {
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
    ? jsonResponse(
        { ok: true, comments: r.comments, nextCursor: r.nextCursor, total: r.total, approximate: r.approximate },
        200,
      )
    : jsonResponse({ error: r.code, message: r.message }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: DataCommentsRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, query) => e.getDataComments(spaceId, query)
  }
  const sp = new URL(request.url).searchParams
  const limitRaw = sp.get('limit')
  const query: DataCommentsQuery = {
    baseId: sp.get('baseId') ?? undefined,
    tableId: sp.get('tableId') ?? undefined,
    status: sp.get('status') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
    limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
  }
  return handleDataComments({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    query,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
