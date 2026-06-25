/**
 * GET /api/spaces/:spaceId/schema — Schema Docs proxy (shared-schema-docs §4).
 * The captured schema entity tree (bases/tables/fields/views) for the Browse
 * tab. Authenticated + IDOR- and tier-gated.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetSchemaResult } from '../../../../lib/backup-engine'
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

export interface SchemaRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string) => Promise<GetSchemaResult>) | null
}

export async function handleSchema(input: SchemaRouteInput): Promise<Response> {
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
  const r = await input.engine(guard.space.id)
  return r.ok
    ? jsonResponse(
        { ok: true, bases: r.bases, tables: r.tables, fields: r.fields, views: r.views },
        200,
      )
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

// ── Astro APIRoute wrapper ───────────────────────────────────────────────

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: SchemaRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId) => e.getSchema(spaceId)
  }
  return handleSchema({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
