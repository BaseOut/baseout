import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createSpaceForOrg,
  listSpacesForOrg,
  SpaceError,
} from '../../../lib/spaces'
import { createBackupEngine } from '../../../lib/backup-engine'
import { resolveEntitlements } from '../../../lib/entitlements/resolve'
import { checkCreationCap } from '../../../lib/entitlements/enforce-create'
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

  // Creation-cap enforcement (shared-entitlements 4.3): block a new Space once the
  // org is at its plan's Spaces cap. Behind ENTITLEMENT_ENFORCEMENT (default off →
  // dark); fails open when there's no resolvable plan. Existing Spaces are never
  // touched — this only guards the create.
  const capDecision = await checkCreationCap(orgId, 'spaces', {
    enforcementEnabled: env.ENTITLEMENT_ENFORCEMENT === '1',
    resolveEntitlements: (id) => resolveEntitlements(locals.db, id),
    count: async (id) => (await listSpacesForOrg(locals.db, id)).length,
  })
  if (!capDecision.allowed) {
    return jsonResponse(
      {
        error: `You've reached your plan's Spaces limit (${capDecision.limit}). Add capacity or upgrade to create another Space.`,
        code: 'limit_reached',
        feature: 'spaces',
        used: capDecision.used,
        limit: capDecision.limit,
        addon: capDecision.addonSlug,
      },
      403,
    )
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
