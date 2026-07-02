/**
 * GET  /api/spaces/:spaceId/chat/threads — list threads
 * POST /api/spaces/:spaceId/chat/threads — create a thread
 * Chat tab proxy (web-chat-tab). Authenticated + IDOR-gated + Pro+ (manual_ai)
 * since Chat is AI.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type ListChatThreadsResult,
  type CreateChatThreadResult,
} from '../../../../../lib/backup-engine'
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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export interface ChatThreadsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  method: 'GET' | 'POST'
  includeArchived: boolean
  userId: string | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: {
    listChatThreads: (spaceId: string, includeArchived: boolean) => Promise<ListChatThreadsResult>
    createChatThread: (spaceId: string, userId: string | null) => Promise<CreateChatThreadResult>
  } | null
}

export async function handleChatThreads(input: ChatThreadsRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response
  // Chat is AI → Pro+ only.
  if (guard.level !== 'manual_ai') return jsonResponse({ error: 'chat_not_entitled' }, 403)
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  if (input.method === 'POST') {
    const r = await input.engine.createChatThread(guard.space.id, input.userId)
    return r.ok ? jsonResponse({ ok: true, id: r.id }, 201) : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }
  const r = await input.engine.listChatThreads(guard.space.id, input.includeArchived)
  return r.ok ? jsonResponse({ ok: true, threads: r.threads }, 200) : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

function buildEngine(): ChatThreadsRouteInput['engine'] {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  const e = createBackupEngine({ binding: env.BACKUP_ENGINE, internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN })
  return {
    listChatThreads: (sid, ia) => e.listChatThreads(sid, ia),
    createChatThread: (sid, uid) => e.createChatThread(sid, uid),
  }
}

export const GET: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleChatThreads({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    method: 'GET',
    includeArchived: new URL(request.url).searchParams.get('includeArchived') === '1',
    userId: locals.account?.user?.id ?? null,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine: buildEngine(),
  })
}

export const POST: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleChatThreads({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    method: 'POST',
    includeArchived: false,
    userId: locals.account?.user?.id ?? null,
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine: buildEngine(),
  })
}
