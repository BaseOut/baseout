/**
 * POST /api/connections/storage/local-fs/connect
 *
 * Connects the dev local-disk destination for the active Space — a managed,
 * zero-setup destination (no OAuth). Upserts the storage_destinations row and
 * sets backup_configurations.storage_type = 'local_fs'. Mirrors the per-provider
 * route layout (box / google-drive) so storage providers stay isolated.
 */

import type { APIRoute } from 'astro'
import { connectLocalFsDestination } from '../../../../../lib/local-fs/persist'

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return jsonError('Not authenticated', 401)
  const account = locals.account
  if (!account?.space) return jsonError('No active space', 403)

  await connectLocalFsDestination(locals.db, {
    spaceId: account.space.id,
    userId: account.user?.id ?? null,
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
