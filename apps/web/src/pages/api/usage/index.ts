import type { APIRoute } from 'astro'
import { and, count, eq, gt, isNotNull, lte, sum } from 'drizzle-orm'
import type { AppDb } from '../../../db'
import { organizationMembers, spaces, usageRollups } from '../../../db/schema'
import { resolveEntitlements } from '../../../lib/entitlements/resolve'
import { buildUsageResponse } from '../../../lib/entitlements/usage-endpoint'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

/**
 * Live creation-cap counts the web (master-DB) scope can measure: Spaces (all org
 * rows) and Seats (accepted members only, per the pricing meter). Bases / documents
 * / reports live in the per-Space engine DB and aren't counted here — they surface
 * as `used: null` (limit-only) in the summary.
 */
async function countCreationUsage(
  db: AppDb,
  organizationId: string,
): Promise<Record<string, number>> {
  const [spaceRow] = await db
    .select({ n: count() })
    .from(spaces)
    .where(eq(spaces.organizationId, organizationId))
  const [seatRow] = await db
    .select({ n: count() })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        isNotNull(organizationMembers.acceptedAt),
      ),
    )
  return { spaces: Number(spaceRow?.n ?? 0), seats: Number(seatRow?.n ?? 0) }
}

/** Org-summed current-period usage per feature slug from usage_rollups (stock/flow). */
async function readCurrentPeriodRollups(
  db: AppDb,
  organizationId: string,
): Promise<Record<string, number>> {
  const now = new Date()
  const rows = await db
    .select({ featureSlug: usageRollups.featureSlug, total: sum(usageRollups.used) })
    .from(usageRollups)
    .where(
      and(
        eq(usageRollups.organizationId, organizationId),
        lte(usageRollups.periodStart, now),
        gt(usageRollups.periodEnd, now),
      ),
    )
    .groupBy(usageRollups.featureSlug)

  const out: Record<string, number> = {}
  for (const row of rows) out[row.featureSlug] = Number(row.total ?? 0)
  return out
}

/**
 * Org-scope usage/limits payload (shared-entitlements task 9.1): every metered
 * limit feature with its effective cap and current usage — stock/flow from
 * usage_rollups, creation caps from live counts. Read-only; auth via middleware.
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const orgId = locals.account?.organization?.id
  if (!orgId) {
    return jsonResponse({ error: 'No active organization' }, 403)
  }

  const result = await buildUsageResponse(orgId, {
    resolveEntitlements: (id) => resolveEntitlements(locals.db, id),
    creationCounts: (id) => countCreationUsage(locals.db, id),
    readRollups: (id) => readCurrentPeriodRollups(locals.db, id),
  })

  return jsonResponse(result, 200)
}
