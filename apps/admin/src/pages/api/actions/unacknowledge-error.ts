// POST /api/actions/unacknowledge-error — staff re-opens an acknowledged error.
// Appends an admin_error_acks 'unack' row via runAudited (CSRF + rate-limit +
// intent/result audit). Auth: role='super' middleware gate.
import type { APIRoute } from 'astro'
import { adminErrorAcks } from '../../../db/schema'
import { buildAuditDeps } from '../../../lib/audit-db'
import { handleAckPost, type HandleAckDeps } from '../../../lib/actions/acknowledge-error'
import { json, methodNotAllowed } from '../../../lib/actions/http'

function buildDeps(locals: App.Locals): HandleAckDeps {
  const db = locals.db
  return {
    audit: buildAuditDeps(db),
    insertAck: async (row) => {
      await db.insert(adminErrorAcks).values(row)
    },
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'invalid_request' })
  }
  return handleAckPost(
    'unack',
    { origin: request.headers.get('origin'), selfOrigin: new URL(request.url).origin, body, actor: { id: locals.user!.id, email: locals.user!.email } },
    buildDeps(locals),
  )
}

export const GET: APIRoute = () => methodNotAllowed()
export const PUT: APIRoute = () => methodNotAllowed()
export const PATCH: APIRoute = () => methodNotAllowed()
export const DELETE: APIRoute = () => methodNotAllowed()
