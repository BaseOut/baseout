/**
 * POST /api/connections/storage/box/disconnect
 *
 * Removes the storage_destinations row for the active Space and flips
 * backup_configurations.storage_type back to 'local_fs'. Files already in the
 * customer's Box account are NOT deleted — that's customer-owned data.
 */

import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { backupConfigurations } from '../../../../../db/schema'
import { deleteBoxDestination } from '../../../../../lib/box/persist'

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return jsonError('Not authenticated', 401)
  const account = locals.account
  if (!account?.space) {
    return jsonError('No active space', 403)
  }
  const spaceId = account.space.id

  const { removed } = await deleteBoxDestination(locals.db, spaceId)
  // Flip storage_type back to local_fs so future runs don't try to use a
  // destination row that no longer exists. Only update if a config row exists
  // for this Space; if none does, the default is already a non-Box value.
  await locals.db
    .update(backupConfigurations)
    .set({ storageType: 'local_fs', modifiedAt: new Date() })
    .where(eq(backupConfigurations.spaceId, spaceId))

  return new Response(
    JSON.stringify({ ok: true, removed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
