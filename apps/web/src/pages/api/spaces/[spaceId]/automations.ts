/**
 * /api/spaces/:spaceId/automations — Automations tab proxy
 * (server-automations-interfaces-manual-crud / web-automations-interfaces-tabs).
 *   GET    → list (optional baseId / includeRemoved)
 *   POST   → create
 *   PATCH  → update
 *   DELETE → soft-remove
 *
 * Authenticated + IDOR- and tier-gated (guardSchemaDocsRequest). CSRF is
 * enforced by better-auth middleware on mutating verbs (same as other Schema
 * Docs proxies).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type GetAutomationsResult,
  type MutateAutomationResult,
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
      airtableEntityId?: string | null
      name?: string | null
      type?: string | null
      definition?: unknown
      tags?: Array<{ targetType: 'table' | 'field'; targetId: string; source?: 'auto' | 'manual' }>
    }
  | {
      action: 'update'
      id: string
      name?: string | null
      type?: string | null
      definition?: unknown
      tags?: Array<{ targetType: 'table' | 'field'; targetId: string; source?: 'auto' | 'manual' }>
    }
  | { action: 'remove'; id: string }

export interface AutomationsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  baseId: string | null
  includeRemoved: boolean
  parseBody: () => Promise<Record<string, unknown>>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  getEngine: ((spaceId: string, baseId: string | undefined, includeRemoved: boolean) => Promise<GetAutomationsResult>) | null
  mutateEngine: ((spaceId: string, body: MutateBody) => Promise<MutateAutomationResult>) | null
}

export async function handleAutomations(input: AutomationsRouteInput): Promise<Response> {
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
      ? jsonResponse({ ok: true, automations: r.automations }, 200)
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
    ? jsonResponse({ ok: true, automation: r.automation }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const ALL: APIRoute = async ({ locals, params, request }) => {
  const method = request.method as AutomationsRouteInput['method']
  if (method !== 'GET' && method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  let getEngine: AutomationsRouteInput['getEngine'] = null
  let mutateEngine: AutomationsRouteInput['mutateEngine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    getEngine = (spaceId, baseId, includeRemoved) => e.getAutomations(spaceId, baseId, includeRemoved)
    mutateEngine = (spaceId, body) => e.mutateAutomation(spaceId, body)
  }

  const sp = new URL(request.url).searchParams
  return handleAutomations({
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
