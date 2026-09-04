/**
 * /api/spaces/:spaceId/interfaces — Interfaces tab proxy
 * (server-automations-interfaces-manual-crud / web-automations-interfaces-tabs).
 *   GET    → list (optional baseId / includeRemoved)
 *   POST   → create (type=page requires parentId)
 *   PATCH  → update
 *   DELETE → soft-remove
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type GetInterfacesResult,
  type MutateInterfaceResult,
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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type MutateBody =
  | {
      action: 'create'
      baseId: string
      type: 'interface' | 'page'
      airtableEntityId?: string | null
      name?: string | null
      parentId?: string | null
      definition?: unknown
      tags?: Array<{ targetType: 'table' | 'field'; targetId: string; source?: 'auto' | 'manual' }>
    }
  | {
      action: 'update'
      id: string
      name?: string | null
      type?: 'interface' | 'page'
      parentId?: string | null
      definition?: unknown
      tags?: Array<{ targetType: 'table' | 'field'; targetId: string; source?: 'auto' | 'manual' }>
    }
  | { action: 'remove'; id: string }

export interface InterfacesRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  baseId: string | null
  includeRemoved: boolean
  parseBody: () => Promise<Record<string, unknown>>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  getEngine: ((spaceId: string, baseId: string | undefined, includeRemoved: boolean) => Promise<GetInterfacesResult>) | null
  mutateEngine: ((spaceId: string, body: MutateBody) => Promise<MutateInterfaceResult>) | null
}

export async function handleInterfaces(input: InterfacesRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (input.method === 'GET') {
    if (!input.getEngine) {
      return jsonResponse(
        { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
        503,
      )
    }
    const r = await input.getEngine(guard.space.id, input.baseId ?? undefined, input.includeRemoved)
    return r.ok
      ? jsonResponse({ ok: true, interfaces: r.interfaces }, 200)
      : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }

  if (!input.mutateEngine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const raw = await input.parseBody()
  let body: MutateBody
  if (input.method === 'POST') {
    if (typeof raw.baseId !== 'string') return jsonResponse({ error: 'invalid_request' }, 400)
    if (raw.type !== 'interface' && raw.type !== 'page') {
      return jsonResponse({ error: 'invalid_request' }, 400)
    }
    if (raw.type === 'page' && (raw.parentId == null || raw.parentId === '')) {
      return jsonResponse({ error: 'invalid_parent' }, 400)
    }
    body = { action: 'create', ...(raw as Omit<Extract<MutateBody, { action: 'create' }>, 'action'>) }
  } else if (input.method === 'PATCH') {
    if (typeof raw.id !== 'string') return jsonResponse({ error: 'invalid_request' }, 400)
    body = { action: 'update', ...(raw as Omit<Extract<MutateBody, { action: 'update' }>, 'action'>) }
  } else if (input.method === 'DELETE') {
    if (typeof raw.id !== 'string') return jsonResponse({ error: 'invalid_request' }, 400)
    body = { action: 'remove', id: raw.id }
  } else {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const r = await input.mutateEngine(guard.space.id, body)
  return r.ok
    ? jsonResponse({ ok: true, interface: r.interface }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const ALL: APIRoute = async ({ locals, params, request }) => {
  const method = request.method as InterfacesRouteInput['method']
  if (method !== 'GET' && method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  let getEngine: InterfacesRouteInput['getEngine'] = null
  let mutateEngine: InterfacesRouteInput['mutateEngine'] = null
  if (env.SERVER && env.SERVER_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.SERVER,
      internalToken: env.SERVER_INTERNAL_TOKEN,
    })
    getEngine = (spaceId, baseId, includeRemoved) => e.getInterfaces(spaceId, baseId, includeRemoved)
    mutateEngine = (spaceId, body) => e.mutateInterface(spaceId, body)
  }

  const sp = new URL(request.url).searchParams
  return handleInterfaces({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    method,
    baseId: sp.get('baseId'),
    includeRemoved: sp.get('includeRemoved') === '1',
    parseBody: async () => {
      try {
        return (await request.json()) as Record<string, unknown>
      } catch {
        return {}
      }
    },
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    getEngine,
    mutateEngine,
  })
}

export const GET = ALL
export const POST = ALL
export const PATCH = ALL
export const DELETE = ALL
