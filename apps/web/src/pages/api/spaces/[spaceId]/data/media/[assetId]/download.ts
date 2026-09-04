/**
 * GET /api/spaces/:spaceId/data/media/:assetId/download
 * Data ▸ Attachment download proxy (web-data-page / server-media-index).
 * Authenticated + IDOR- and tier-gated (Schema Docs level), then streams the
 * engine's download passthrough: Baseout-stored (r2_managed) bytes stream
 * through; BYOS assets return the destination-locator JSON ("Open in {provider}").
 * Non-2xx engine responses (incl. 501 for non-`managed_pg`) pass their status through.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine } from '../../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  type SpaceRowForDocs,
} from '../../../../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../../../../lib/capabilities/tier-capabilities'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface DataMediaDownloadRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  assetId: string | undefined
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, assetId: string) => Promise<Response>) | null
}

/** Copy only the safe passthrough headers so no engine-internal header leaks. */
function passthroughHeaders(src: Headers): Headers {
  const out = new Headers()
  for (const h of ['content-type', 'content-length', 'content-disposition']) {
    const v = src.get(h)
    if (v) out.set(h, v)
  }
  return out
}

export async function handleDataMediaDownload(input: DataMediaDownloadRouteInput): Promise<Response> {
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

  let engineRes: Response
  try {
    engineRes = await input.engine(guard.space.id, input.assetId)
  } catch {
    return jsonResponse({ error: 'engine_unreachable' }, 502)
  }
  return new Response(engineRes.body, {
    status: engineRes.status,
    headers: passthroughHeaders(engineRes.headers),
  })
}

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: DataMediaDownloadRouteInput['engine'] = null
  if (env.SERVER && env.SERVER_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.SERVER,
      internalToken: env.SERVER_INTERNAL_TOKEN,
    })
    engine = (spaceId, assetId) => e.mediaDownload(spaceId, assetId)
  }
  return handleDataMediaDownload({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    assetId: params.assetId,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
