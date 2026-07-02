/**
 * GET /api/spaces/:spaceId/relationships?baseId=appXXX[&includeDismissed=1]
 * Relationships tab proxy (web-relationships-tab). Returns a base's API-derived
 * relationships + synced-view candidates. Authenticated + IDOR- and tier-gated
 * (Schema Docs level).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetRelationshipsResult } from '../../../../lib/backup-engine'
import type { AccountContext } from '../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../lib/capabilities/tier-capabilities'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface RelationshipsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  baseId: string | null
  includeDismissed: boolean
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | ((spaceId: string, baseId: string, includeDismissed: boolean) => Promise<GetRelationshipsResult>)
    | null
}

export async function handleRelationships(input: RelationshipsRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (!input.baseId) return jsonResponse({ error: 'invalid_request' }, 400)
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(guard.space.id, input.baseId, input.includeDismissed)
  return r.ok
    ? jsonResponse({ ok: true, derived: r.derived, syncedViews: r.syncedViews }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: RelationshipsRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, baseId, includeDismissed) => e.getRelationships(spaceId, baseId, includeDismissed)
  }
  const sp = new URL(request.url).searchParams
  return handleRelationships({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    baseId: sp.get('baseId'),
    includeDismissed: sp.get('includeDismissed') === '1',
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
