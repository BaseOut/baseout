import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createSpaceForOrg,
  listSpacesForOrg,
  SpaceError,
} from '../../../lib/spaces'
import { createBackupEngine } from '../../../lib/backup-engine'
import {
  extractSessionTokenCookie,
  invalidateSessionCache,
} from '../../../lib/session-cache'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const orgId = locals.account?.organization?.id
  if (!orgId) {
    return jsonResponse({ error: 'No active organization' }, 403)
  }

  const list = await listSpacesForOrg(locals.db, orgId)
  const activeSpaceId = locals.account?.space?.id ?? null
  return jsonResponse({ spaces: list, activeSpaceId }, 200)
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const orgId = locals.account?.organization?.id
  if (!orgId) {
    return jsonResponse({ error: 'No active organization' }, 403)
  }

  const sessionToken = extractSessionTokenCookie(
    request.headers.get('cookie') ?? '',
  )

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  try {
    const created = await createSpaceForOrg(locals.db, {
      userId: locals.user.id,
      organizationId: orgId,
      name: typeof body.name === 'string' ? body.name : '',
    })
    invalidateSessionCache(sessionToken)

    // Provision the Space's dedicated per-Space DB. The engine owns the
    // per-Space DB lifecycle (web never connects to it), so this goes over the
    // service binding. Best-effort: the Space row is already committed; a
    // provisioning failure is recorded on space_databases (status='error') for
    // retry, not fatal to Space creation. records_enabled=false — the DB always
    // exists for schema/attachments; the record tables turn on with dynamic mode.
    let provisioning = 'skipped'
    if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
      const engine = createBackupEngine({
        binding: env.BACKUP_ENGINE,
        internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
      })
      const result = await engine.provisionDatabase(created.id, {
        backend: 'managed_pg',
        recordsEnabled: false,
        provisionedByUserId: locals.user.id,
      })
      provisioning = result.ok ? result.status : result.code
    }

    return jsonResponse({ ok: true, space: created, provisioning }, 200)
  } catch (err) {
    if (err instanceof SpaceError && err.detail.kind === 'invalid') {
      return jsonResponse(
        { error: err.detail.message, field: err.detail.field },
        400,
      )
    }
    throw err
  }
}
