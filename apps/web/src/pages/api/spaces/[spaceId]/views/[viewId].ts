/**
 * /api/spaces/:spaceId/views/:viewId — saved-views proxy (web-saved-views D4)
 *   GET    → one saved view
 *   PATCH  → update name/config/pinned/sortOrder (tableId immutable → 400 table_locked)
 *   DELETE → delete
 *
 * Authenticated + IDOR- and tier-gated, then forwards to @baseout/server.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type DeleteSavedViewResult,
  type SavedViewResult,
  type UpdateSavedViewInput,
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

export interface ViewItemRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  viewId: string | undefined
  method: 'GET' | 'PATCH' | 'DELETE'
  parseBody: () => Promise<unknown>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | {
        updateSavedView: (spaceId: string, viewId: string, patch: UpdateSavedViewInput) => Promise<SavedViewResult>
        deleteSavedView: (spaceId: string, viewId: string) => Promise<DeleteSavedViewResult>
        getSavedView: (spaceId: string, viewId: string) => Promise<SavedViewResult>
      }
    | null
}

export async function handleViewItem(input: ViewItemRouteInput): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (!input.viewId || !UUID_RE.test(input.viewId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }
  const viewId = input.viewId

  if (input.method === 'GET') {
    const r = await input.engine.getSavedView(guard.space.id, viewId)
    return r.ok
      ? jsonResponse({ ok: true, view: r.view }, 200)
      : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }

  if (input.method === 'DELETE') {
    const r = await input.engine.deleteSavedView(guard.space.id, viewId)
    return r.ok ? jsonResponse({ ok: true }, 200) : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }

  let body: unknown
  try {
    body = await input.parseBody()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const r = await input.engine.updateSavedView(guard.space.id, viewId, body as UpdateSavedViewInput)
  return r.ok
    ? jsonResponse({ ok: true, view: r.view }, 200)
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
    getSavedView: (spaceId: string, viewId: string) => e.getSavedView(spaceId, viewId),
    updateSavedView: (spaceId: string, viewId: string, patch: UpdateSavedViewInput) =>
      e.updateSavedView(spaceId, viewId, patch),
    deleteSavedView: (spaceId: string, viewId: string) => e.deleteSavedView(spaceId, viewId),
  }
}

const route =
  (method: 'GET' | 'PATCH' | 'DELETE'): APIRoute =>
  async ({ locals, params, request }) => {
    const db = locals.db
    if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
    return handleViewItem({
      account: locals.account ?? null,
      spaceId: params.spaceId,
      viewId: params.viewId,
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
