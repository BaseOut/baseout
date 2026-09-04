/**
 * GET /api/spaces/:spaceId/data/search?q=<text>[&baseId&tableId]
 * Data ▸ record-search proxy (web-entity-deeplinks 1.3) — wires the previously
 * orphaned engine data-search broker so the Data page can adopt real
 * server-side record search. Authenticated + IDOR- and tier-gated exactly like
 * the records proxy; 501 for non-managed_pg Spaces.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type DataSearchResult } from '../../../../../lib/backup-engine'
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

export interface DataSearchRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  q: string | null
  baseId: string | null
  tableId: string | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, q: string, opts: { baseId?: string; tableId?: string }) => Promise<DataSearchResult>) | null
}

export async function handleDataSearch(input: DataSearchRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  const q = input.q?.trim()
  if (!q) return jsonResponse({ error: 'invalid_request', param: 'q' }, 400)
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(guard.space.id, q, {
    baseId: input.baseId?.trim() || undefined,
    tableId: input.tableId?.trim() || undefined,
  })
  return r.ok
    ? jsonResponse({ ok: true, groups: r.groups, partial: r.partial }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

// ── Astro APIRoute wrapper ───────────────────────────────────────────────

export const GET: APIRoute = async ({ locals, params, url }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  const engineBinding = env.SERVER
  const engineToken = env.SERVER_INTERNAL_TOKEN
  const engine =
    engineBinding && engineToken
      ? (() => {
          const e = createBackupEngine({ binding: engineBinding, internalToken: engineToken })
          return (spaceId: string, q: string, opts: { baseId?: string; tableId?: string }) => e.dataSearch(spaceId, q, opts)
        })()
      : null
  return handleDataSearch({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    q: url.searchParams.get('q'),
    baseId: url.searchParams.get('baseId'),
    tableId: url.searchParams.get('tableId'),
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
