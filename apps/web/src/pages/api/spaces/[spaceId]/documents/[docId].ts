/**
 * /api/spaces/:spaceId/documents/:docId — Schema Docs proxy (shared-schema-docs §4)
 *   GET    → full document
 *   PATCH  → atomic save
 *   DELETE → delete
 *
 * Authenticated + IDOR- and tier-gated, then forwards to @baseout/server.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type DeleteDocumentResult,
  type GetDocumentResult,
  type UpdateDocumentResult,
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface DocumentItemRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  documentId: string | undefined
  method: 'GET' | 'PATCH' | 'DELETE'
  parseBody: () => Promise<unknown>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | {
        getDocument: (spaceId: string, docId: string) => Promise<GetDocumentResult>
        updateDocument: (spaceId: string, docId: string, patch: unknown) => Promise<UpdateDocumentResult>
        deleteDocument: (spaceId: string, docId: string) => Promise<DeleteDocumentResult>
      }
    | null
}

export async function handleDocumentItem(input: DocumentItemRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (!input.documentId || !UUID_RE.test(input.documentId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }
  const docId = input.documentId

  if (input.method === 'GET') {
    const r = await input.engine.getDocument(guard.space.id, docId)
    return r.ok
      ? jsonResponse({ ok: true, document: r.document }, 200)
      : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }
  if (input.method === 'PATCH') {
    let body: unknown
    try {
      body = await input.parseBody()
    } catch {
      return jsonResponse({ error: 'invalid_request' }, 400)
    }
    const r = await input.engine.updateDocument(guard.space.id, docId, body)
    return r.ok
      ? jsonResponse({ ok: true, document: r.document }, 200)
      : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }
  // DELETE
  const r = await input.engine.deleteDocument(guard.space.id, docId)
  return r.ok ? jsonResponse({ ok: true }, 200) : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

// ── Astro APIRoute wrappers ──────────────────────────────────────────────

function buildEngine() {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.BACKUP_ENGINE,
    internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
  return {
    getDocument: (spaceId: string, docId: string) => e.getDocument(spaceId, docId),
    updateDocument: (spaceId: string, docId: string, patch: unknown) =>
      e.updateDocument(spaceId, docId, patch as Parameters<typeof e.updateDocument>[2]),
    deleteDocument: (spaceId: string, docId: string) => e.deleteDocument(spaceId, docId),
  }
}

const route =
  (method: 'GET' | 'PATCH' | 'DELETE'): APIRoute =>
  async ({ locals, params, request }) => {
    const db = locals.db
    if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
    return handleDocumentItem({
      account: locals.account ?? null,
      spaceId: params.spaceId,
      documentId: params.docId,
      method,
      parseBody: () => request.json(),
      fetchSpace: (id) => fetchSpaceById(db, id),
      resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
      engine: buildEngine(),
    })
  }

export const GET = route('GET')
export const PATCH = route('PATCH')
export const DELETE = route('DELETE')
