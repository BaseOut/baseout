// Reports master-DB queries owned by apps/web (web-reports-page task 2.3).

import { and, eq, sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { reportDefinitions, spaces } from '../../db/schema'

/**
 * Count user-created (non-default) report definitions across an Org's Spaces —
 * the denominator for the `active_reports` creation cap. Auto-created default
 * reports don't count against the quota.
 */
export async function countActiveReportsForOrg(
  db: AppDb,
  orgId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reportDefinitions)
    .innerJoin(spaces, eq(reportDefinitions.spaceId, spaces.id))
    .where(
      and(eq(spaces.organizationId, orgId), eq(reportDefinitions.isDefault, false)),
    )
  return row?.n ?? 0
}
