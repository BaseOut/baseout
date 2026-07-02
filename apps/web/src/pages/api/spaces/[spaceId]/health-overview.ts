/**
 * GET /api/spaces/:spaceId/health-overview?baseId=appXXX — Health tab proxy
 * (web-health-tab). Returns a base's grade + per-metric breakdown + issues.
 * Authenticated + IDOR- and tier-gated (Schema Docs level — Health is Launch+).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetHealthOverviewResult } from '../../../../lib/backup-engine'
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

export interface HealthOverviewRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  baseId: string | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, baseId: string) => Promise<GetHealthOverviewResult>) | null
}

export async function handleHealthOverview(input: HealthOverviewRouteInput): Promise<Response> {
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

  const r = await input.engine(guard.space.id, input.baseId)
  return r.ok
    ? jsonResponse({ ok: true, grade: r.grade, metrics: r.metrics, issues: r.issues }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

// ── Astro APIRoute wrapper ───────────────────────────────────────────────

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: HealthOverviewRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, baseId) => e.getHealthOverview(spaceId, baseId)
  }
  const baseId = new URL(request.url).searchParams.get('baseId')
  return handleHealthOverview({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    baseId,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
