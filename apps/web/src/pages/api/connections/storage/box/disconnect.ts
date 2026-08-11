/**
 * POST /api/connections/storage/box/disconnect
 *
 * Removes the active Space's Box destination row. If Box was the primary
 * (backup_configurations.storage_type), repoints to the most recently
 * connected remaining destination (local_fs when none remain). Files already
 * in the customer's Box account are NOT deleted — that's customer-owned data.
 */

import type { APIRoute } from 'astro'
import { repointStorageTypeAfterDisconnect } from '../../../../../lib/backup-config/storage-type'
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
  // If Box was the primary, repoint storage_type so future runs don't
  // reference a destination row that no longer exists.
  await repointStorageTypeAfterDisconnect(locals.db, spaceId, 'box')

  return new Response(
    JSON.stringify({ ok: true, removed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
