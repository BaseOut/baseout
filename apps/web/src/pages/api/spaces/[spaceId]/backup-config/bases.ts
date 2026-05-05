/**
 * POST /api/spaces/[spaceId]/backup-config/bases
 *
 * Persists which Bases in the Space are included in backups. Body shape:
 *   { atBaseIds: string[] }   // at_bases.id values (internal pks)
 *
 * Gates the selection by the org's tier cap (Features §4.1) via
 * resolveCapabilities. Idempotent.
 */

import type { APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { atBases, backupConfigurationBases, backupConfigurations, spaces } from '../../../../../db/schema'
import { resolveCapabilities } from '../../../../../lib/capabilities/resolve'
import { planBaseSelection } from '../../../../../lib/backup-config/select-bases'
import { persistBaseSelection } from '../../../../../lib/backup-config/persist'

interface RequestBody {
  atBaseIds: unknown
}

function jsonError(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const account = locals.account
  if (!account?.organization?.id || !account?.user?.id) {
    return jsonError(401, { error: 'Not authenticated' })
  }
  const organizationId = account.organization.id

  const db = locals.db
  if (!db) {
    return jsonError(500, { error: 'Database not initialized' })
  }

  const spaceId = params.spaceId
  if (!spaceId) {
    return jsonError(400, { error: 'Missing spaceId' })
  }

  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(
      and(
        eq(spaces.id, spaceId),
        eq(spaces.organizationId, organizationId),
      ),
    )
    .limit(1)
  if (!space) {
    return jsonError(403, { error: 'Space not in active organization' })
  }

  let parsed: RequestBody
  try {
    parsed = (await request.json()) as RequestBody
  } catch {
    return jsonError(400, { error: 'Invalid JSON body' })
  }
  const requestedBaseIds = Array.isArray(parsed.atBaseIds)
    ? parsed.atBaseIds.filter((v): v is string => typeof v === 'string')
    : null
  if (requestedBaseIds === null) {
    return jsonError(400, { error: 'atBaseIds must be a string array' })
  }

  const caps = await resolveCapabilities(db, organizationId, 'airtable')

  const allBaseRows = await db
    .select({ id: atBases.id })
    .from(atBases)
    .where(eq(atBases.spaceId, spaceId))
  const allBaseIds = allBaseRows.map((r) => r.id)

  const currentRows = await db
    .select({ atBaseId: backupConfigurationBases.atBaseId })
    .from(backupConfigurationBases)
    .innerJoin(
      backupConfigurations,
      eq(backupConfigurations.id, backupConfigurationBases.backupConfigurationId),
    )
    .where(
      and(
        eq(backupConfigurations.spaceId, spaceId),
        eq(backupConfigurationBases.isIncluded, true),
      ),
    )
  const currentSelectedIds = currentRows.map((r) => r.atBaseId)

  const plan = planBaseSelection({
    allBaseIds,
    requestedBaseIds,
    currentSelectedIds,
    basesPerSpace: caps.capabilities.basesPerSpace,
  })

  if (!plan.ok) {
    if (plan.reason === 'over_tier_limit') {
      return jsonError(422, {
        error: 'over_tier_limit',
        limit: plan.limit,
        requested: plan.requested,
      })
    }
    return jsonError(422, { error: plan.reason, unknownIds: plan.unknownIds })
  }

  await persistBaseSelection(db, {
    spaceId,
    toEnable: plan.toEnable,
    toDisable: plan.toDisable,
  })

  return new Response(
    JSON.stringify({
      ok: true,
      included: requestedBaseIds.length,
      basesPerSpace: caps.capabilities.basesPerSpace,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
