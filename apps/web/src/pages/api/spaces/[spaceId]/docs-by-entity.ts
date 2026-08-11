/**
 * GET /api/spaces/:spaceId/docs-by-entity?targetType=&targetId=
 * Schema Docs proxy (shared-schema-docs §4) — docs that tag a given entity,
 * for the Browse-tab detail panel. Authenticated + IDOR- and tier-gated.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type DocsByEntityResult,
  type SchemaDocTargetType,
} from '../../../../lib/backup-engine'
import type { AccountContext } from '../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../lib/capabilities/tier-capabilities'

const TARGET_TYPES: readonly SchemaDocTargetType[] = ['base', 'table', 'field', 'view']

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface DocsByEntityRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  targetType: string | null
  targetId: string | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | ((spaceId: string, t: SchemaDocTargetType, id: string) => Promise<DocsByEntityResult>)
    | null
}

export async function handleDocsByEntity(input: DocsByEntityRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (
    !input.targetType ||
    !TARGET_TYPES.includes(input.targetType as SchemaDocTargetType) ||
    !input.targetId
  ) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }
  const r = await input.engine(guard.space.id, input.targetType as SchemaDocTargetType, input.targetId)
  return r.ok
    ? jsonResponse({ ok: true, entityRemoved: r.entityRemoved, documents: r.documents }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

// ── Astro APIRoute wrapper ───────────────────────────────────────────────

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  const url = new URL(request.url)
  let engine: DocsByEntityRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, t, id) => e.docsByEntity(spaceId, t, id)
  }
  return handleDocsByEntity({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    targetType: url.searchParams.get('targetType'),
    targetId: url.searchParams.get('targetId'),
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
