/**
 * /api/spaces/:spaceId/views — saved-views proxy (web-saved-views D4)
 *   GET  → list saved views (Data Browse presets)
 *   POST → create a saved view
 *
 * Authenticated + IDOR- and tier-gated (guardSchemaDocsRequest — the same gate
 * the Data proxies use), then forwards to @baseout/server via the
 * SERVER service binding. Testable inner handler takes deps as args.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type CreateSavedViewInput,
  type ListSavedViewsResult,
  type SavedViewResult,
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

export interface ViewsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  method: 'GET' | 'POST'
  parseBody: () => Promise<unknown>
  userId: string | null
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine:
    | {
        listSavedViews: (spaceId: string) => Promise<ListSavedViewsResult>
        createSavedView: (spaceId: string, input: CreateSavedViewInput) => Promise<SavedViewResult>
      }
    | null
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

export async function handleViews(input: ViewsRouteInput): Promise<Response> {
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
    const r = await input.engine.listSavedViews(guard.space.id)
    return r.ok
      ? jsonResponse({ ok: true, views: r.views }, 200)
      : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
  }

  let body: unknown
  try {
    body = await input.parseBody()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  // Shape validation is the broker's job (parseCreateSavedView); the proxy only
  // gates the obvious (name/tableId/config present) to fail fast client-side.
  const b = body as { name?: unknown; tableId?: unknown; config?: unknown }
  if (typeof b?.name !== 'string' || b.name.trim() === '' || typeof b?.tableId !== 'string' || !isPlainObject(b?.config)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const r = await input.engine.createSavedView(guard.space.id, {
    ...(body as CreateSavedViewInput),
    createdByUserId: input.userId,
  })
  return r.ok
    ? jsonResponse({ ok: true, view: r.view }, 201)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

// ── Astro APIRoute wrappers ──────────────────────────────────────────────

function buildEngine() {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return {
    listSavedViews: (spaceId: string) => e.listSavedViews(spaceId),
    createSavedView: (spaceId: string, input: CreateSavedViewInput) => e.createSavedView(spaceId, input),
  }
}

const route =
  (method: 'GET' | 'POST'): APIRoute =>
  async ({ locals, params, request }) => {
    const db = locals.db
    if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
    return handleViews({
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
