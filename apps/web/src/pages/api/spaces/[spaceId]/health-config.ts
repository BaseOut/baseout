/**
 * GET /api/spaces/:spaceId/health-config?baseId=appXXX — Pro+ Health editor data
 * (web-health-tab). Metric catalog with per-base enabled state + effective
 * prompts + staleness. Authenticated + IDOR-gated + Pro+ (manual_ai).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetHealthConfigResult } from '../../../../lib/backup-engine'
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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export interface HealthConfigRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  baseId: string | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, baseId: string) => Promise<GetHealthConfigResult>) | null
}

export async function handleHealthConfig(input: HealthConfigRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response
  if (guard.level !== 'manual_ai') return jsonResponse({ error: 'health_editor_not_entitled' }, 403)
  if (!input.baseId) return jsonResponse({ error: 'invalid_request' }, 400)
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  const r = await input.engine(guard.space.id, input.baseId)
  return r.ok
    ? jsonResponse({ ok: true, metrics: r.metrics }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: HealthConfigRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({ binding: env.BACKUP_ENGINE, internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN })
    engine = (sid, bid) => e.getHealthConfig(sid, bid)
  }
  return handleHealthConfig({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    baseId: new URL(request.url).searchParams.get('baseId'),
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
