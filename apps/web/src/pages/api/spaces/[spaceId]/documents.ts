/**
 * /api/spaces/:spaceId/documents  — Schema Docs proxy (shared-schema-docs §4)
 *   GET  → list documents
 *   POST → create a document
 *
 * Authenticated + IDOR- and tier-gated (guardSchemaDocsRequest), then forwards
 * to @baseout/server via the BACKUP_ENGINE service binding. The browser never
 * touches the per-Space DB. Testable inner handler takes deps as args.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type CreateDocumentResult,
  type ListDocumentsResult,
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

export interface DocumentsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  method: 'GET' | 'POST'
  parseBody: () => Promise<unknown>
  userId: string | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | {
        listDocuments: (spaceId: string) => Promise<ListDocumentsResult>
        createDocument: (spaceId: string, input: unknown) => Promise<CreateDocumentResult>
      }
    | null
}

export async function handleDocuments(input: DocumentsRouteInput): Promise<Response> {
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

  if (input.method === 'GET') {
    const r = await input.engine.listDocuments(guard.space.id)
    return r.ok
      ? jsonResponse({ ok: true, documents: r.documents }, 200)
      : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }

  let body: unknown
  try {
    body = await input.parseBody()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const title = (body as { title?: unknown })?.title
  if (typeof title !== 'string' || title.trim() === '') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const r = await input.engine.createDocument(guard.space.id, {
    ...(body as object),
    createdByUserId: input.userId,
  })
  return r.ok
    ? jsonResponse({ ok: true, document: r.document }, 201)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

// ── Astro APIRoute wrappers ──────────────────────────────────────────────

function buildEngine() {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.BACKUP_ENGINE,
    internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
  return {
    listDocuments: (spaceId: string) => e.listDocuments(spaceId),
    createDocument: (spaceId: string, body: unknown) =>
      e.createDocument(spaceId, body as Parameters<typeof e.createDocument>[1]),
  }
}

const route =
  (method: 'GET' | 'POST'): APIRoute =>
  async ({ locals, params, request }) => {
    const db = locals.db
    if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
    return handleDocuments({
      account: locals.account ?? null,
      spaceId: params.spaceId,
      method,
      parseBody: () => request.json(),
      userId: locals.account?.user?.id ?? null,
      fetchSpace: (id) => fetchSpaceById(db, id),
      resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
      engine: buildEngine(),
    })
  }

export const GET = route('GET')
export const POST = route('POST')
