/**
 * POST /api/connections/storage/onedrive/disconnect
 *
 * Removes the active Space's OneDrive destination row. If OneDrive was the
 * primary (backup_configurations.storage_type), repoints to the most recently
 * connected remaining destination (local_fs when none remain). Files already
 * in the customer's OneDrive account are NOT deleted — that's customer-owned
 * data.
 */

import type { APIRoute } from 'astro'
import { repointStorageTypeAfterDisconnect } from '../../../../../lib/backup-config/storage-type'
import { deleteOneDriveDestination } from '../../../../../lib/onedrive/persist'

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

  const { removed } = await deleteOneDriveDestination(locals.db, spaceId)
  // If OneDrive was the primary, repoint storage_type so future runs don't
  // reference a destination row that no longer exists.
  await repointStorageTypeAfterDisconnect(locals.db, spaceId, 'onedrive')

  return new Response(
    JSON.stringify({ ok: true, removed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
