/**
 * GET /api/spaces/:spaceId/data/media[?class&baseId&tableId&minSize&maxSize&after&before&cursor&limit]
 * Data ▸ Attachments proxy (web-data-page / server-media-index). Newest-first,
 * keyset-paginated captured-attachment listing. Authenticated + IDOR- and
 * tier-gated (Schema Docs level). 501 for non-`managed_pg` Spaces.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetMediaResult, type MediaQuery } from '../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../../lib/capabilities/tier-capabilities'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Read a MediaQuery off the request search params (shared by media + totals). */
export function parseMediaQuery(sp: URLSearchParams): MediaQuery {
  const num = (k: string) => {
    const v = sp.get(k)
    if (v === null || v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return {
    class: sp.get('class') ?? undefined,
    baseId: sp.get('baseId') ?? undefined,
    tableId: sp.get('tableId') ?? undefined,
    minSize: num('minSize'),
    maxSize: num('maxSize'),
    after: sp.get('after') ?? undefined,
    before: sp.get('before') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
    limit: num('limit'),
  }
}

export interface DataMediaRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  query: MediaQuery
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, query?: MediaQuery) => Promise<GetMediaResult>) | null
}

export async function handleDataMedia(input: DataMediaRouteInput): Promise<Response> {
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

  const r = await input.engine(guard.space.id, input.query)
  return r.ok
    ? jsonResponse({ ok: true, items: r.items, nextCursor: r.nextCursor }, 200)
    : jsonResponse({ error: r.code, message: r.message }, schemaDocsErrorStatus(r.code))
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: DataMediaRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, query) => e.getMedia(spaceId, query)
  }
  return handleDataMedia({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    query: parseMediaQuery(new URL(request.url).searchParams),
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
