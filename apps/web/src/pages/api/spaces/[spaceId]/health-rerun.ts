/**
 * POST /api/spaces/:spaceId/health-rerun — re-score a base's Health (Pro+).
 * web-health-tab. Authenticated + IDOR-gated + Pro+ (manual_ai). Enqueues the
 * scoring task engine-side; the tab polls the overview until scores land.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type RerunHealthResult } from '../../../../lib/backup-engine'
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

export interface HealthRerunRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  parseBody: () => Promise<Record<string, unknown>>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, baseId: string) => Promise<RerunHealthResult>) | null
}

export async function handleHealthRerun(input: HealthRerunRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response
  if (guard.level !== 'manual_ai') return jsonResponse({ error: 'health_editor_not_entitled' }, 403)
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  const body = await input.parseBody()
  if (typeof body.baseId !== 'string' || body.baseId.length === 0) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const r = await input.engine(guard.space.id, body.baseId)
  return r.ok
    ? jsonResponse({ ok: true, enqueued: r.enqueued, runId: r.runId, metricCount: r.metricCount }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: HealthRerunRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({ binding: env.BACKUP_ENGINE, internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN })
    engine = (sid, bid) => e.rerunHealth(sid, bid)
  }
  return handleHealthRerun({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    parseBody: async () => {
      try {
        return (await request.json()) as Record<string, unknown>
      } catch {
        return {}
      }
    },
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
