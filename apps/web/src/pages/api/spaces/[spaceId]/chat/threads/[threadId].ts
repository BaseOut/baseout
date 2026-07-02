/**
 * GET   /api/spaces/:spaceId/chat/threads/:threadId — thread + messages (polled)
 * PATCH /api/spaces/:spaceId/chat/threads/:threadId — rename / archive / context
 * Chat tab proxy (web-chat-tab). Authenticated + IDOR-gated + Pro+ (manual_ai).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type GetChatThreadResult,
  type PatchChatThreadResult,
  type ChatThreadDetailView,
} from '../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../../../lib/capabilities/tier-capabilities'

type PatchBody =
  | { title: string }
  | { archived: boolean }
  | { scope: ChatThreadDetailView['scope']; attachedDocIds: string[] }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export interface ChatThreadRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  threadId: string | undefined
  method: 'GET' | 'PATCH'
  parseBody: () => Promise<Record<string, unknown>>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: {
    getChatThread: (spaceId: string, threadId: string) => Promise<GetChatThreadResult>
    patchChatThread: (spaceId: string, threadId: string, body: PatchBody) => Promise<PatchChatThreadResult>
  } | null
}

export async function handleChatThread(input: ChatThreadRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response
  if (guard.level !== 'manual_ai') return jsonResponse({ error: 'chat_not_entitled' }, 403)
  if (!input.threadId) return jsonResponse({ error: 'invalid_request' }, 400)
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  if (input.method === 'GET') {
    const r = await input.engine.getChatThread(guard.space.id, input.threadId)
    return r.ok ? jsonResponse({ ok: true, thread: r.thread }, 200) : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }

  const body = await input.parseBody()
  const valid =
    typeof body.title === 'string' ||
    typeof body.archived === 'boolean' ||
    'scope' in body ||
    'attachedDocIds' in body
  if (!valid) return jsonResponse({ error: 'invalid_request' }, 400)
  const r = await input.engine.patchChatThread(guard.space.id, input.threadId, body as PatchBody)
  return r.ok ? jsonResponse({ ok: true }, 200) : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

function buildEngine(): ChatThreadRouteInput['engine'] {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  const e = createBackupEngine({ binding: env.BACKUP_ENGINE, internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN })
  return {
    getChatThread: (sid, tid) => e.getChatThread(sid, tid),
    patchChatThread: (sid, tid, body) => e.patchChatThread(sid, tid, body),
  }
}

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleChatThread({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    threadId: params.threadId,
    method: 'GET',
    parseBody: async () => ({}),
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine: buildEngine(),
  })
}

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleChatThread({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    threadId: params.threadId,
    method: 'PATCH',
    parseBody: async () => {
      try {
        return (await request.json()) as Record<string, unknown>
      } catch {
        return {}
      }
    },
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine: buildEngine(),
  })
}
