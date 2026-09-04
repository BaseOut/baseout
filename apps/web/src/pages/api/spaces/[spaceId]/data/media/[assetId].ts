/**
 * GET /api/spaces/:spaceId/data/media/:assetId
 * Data ▸ Attachment detail proxy (one captured file + all refs). Authenticated +
 * IDOR- and tier-gated (Schema Docs level). 501 for non-`managed_pg` Spaces.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetMediaAssetResult } from '../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../../../lib/capabilities/tier-capabilities'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface DataMediaAssetRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  assetId: string | undefined
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, assetId: string) => Promise<GetMediaAssetResult>) | null
}

export async function handleDataMediaAsset(input: DataMediaAssetRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (!input.assetId || !UUID_RE.test(input.assetId)) {
    return jsonResponse({ error: 'invalid_request', param: 'assetId' }, 400)
  }
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(guard.space.id, input.assetId)
  return r.ok
    ? jsonResponse({ ok: true, asset: r.asset }, 200)
    : jsonResponse({ error: r.code, message: r.message }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: DataMediaAssetRouteInput['engine'] = null
  if (env.SERVER && env.SERVER_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.SERVER,
      internalToken: env.SERVER_INTERNAL_TOKEN,
    })
    engine = (spaceId, assetId) => e.getMediaAsset(spaceId, assetId)
  }
  return handleDataMediaAsset({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    assetId: params.assetId,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
