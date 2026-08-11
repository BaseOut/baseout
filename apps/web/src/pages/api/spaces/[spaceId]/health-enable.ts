/**
 * POST /api/spaces/:spaceId/health-enable — enable/disable a metric for a base
 * (Pro+). web-health-tab. Authenticated + IDOR-gated + Pro+ (manual_ai).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type HealthMutationResult } from '../../../../lib/backup-engine'
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

export interface HealthEnableRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  parseBody: () => Promise<Record<string, unknown>>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | ((spaceId: string, body: { baseId: string; ruleId: string; enabled: boolean }) => Promise<HealthMutationResult>)
    | null
}

export async function handleHealthEnable(input: HealthEnableRouteInput): Promise<Response> {
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
  if (
    typeof body.baseId !== 'string' ||
    typeof body.ruleId !== 'string' ||
    typeof body.enabled !== 'boolean'
  ) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const r = await input.engine(guard.space.id, {
    baseId: body.baseId,
    ruleId: body.ruleId,
    enabled: body.enabled,
  })
  return r.ok ? jsonResponse({ ok: true }, 200) : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: HealthEnableRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({ binding: env.BACKUP_ENGINE, internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN })
    engine = (sid, body) => e.setHealthEnable(sid, body)
  }
  return handleHealthEnable({
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
