/**
 * GET /api/spaces/:spaceId/changelog?baseId=appXXX[&limit=200]
 * Changelog tab proxy (web-schema-changelog). Returns a base's schema changelog
 * (modifications + lifecycle removals). Authenticated + IDOR- and tier-gated
 * (Schema Docs level).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetSchemaChangelogResult } from '../../../../lib/backup-engine'
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

export interface ChangelogRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  baseId: string | null
  limit: number | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | ((spaceId: string, baseId: string, limit?: number) => Promise<GetSchemaChangelogResult>)
    | null
}

export async function handleChangelog(input: ChangelogRouteInput): Promise<Response> {
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

  const r = await input.engine(guard.space.id, input.baseId, input.limit ?? undefined)
  return r.ok
    ? jsonResponse({ ok: true, entries: r.entries }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: ChangelogRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, baseId, limit) => e.getSchemaChangelog(spaceId, baseId, limit)
  }
  const sp = new URL(request.url).searchParams
  const limitRaw = sp.get('limit')
  return handleChangelog({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    baseId: sp.get('baseId'),
    limit: limitRaw ? parseInt(limitRaw, 10) : null,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
