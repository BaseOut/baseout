/**
 * PATCH /api/spaces/:spaceId — rename the active Space.
 *
 * Name is the one Settings field that is both a real product control and a
 * master-DB write. Deletion stays gated (no route). Tests import handlePatch.
 */
import type { APIRoute } from 'astro'
import { renameSpace, SpaceError } from '../../../lib/spaces'
import type { AccountContext } from '../../../lib/account'
import type { AppDb } from '../../../db'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface HandlePatchInput {
  account: AccountContext | null
  spaceId: string | undefined
  body: unknown
  rename: typeof renameSpace
  db: AppDb
}

export async function handlePatch(input: HandlePatchInput): Promise<Response> {
  if (!input.account?.organization?.id || !input.account.user?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const name =
    input.body && typeof input.body === 'object' && 'name' in input.body
      ? (input.body as { name: unknown }).name
      : undefined
  try {
    const updated = await input.rename(input.db, {
      spaceId: input.spaceId,
      organizationId: input.account.organization.id,
      name: name as string,
    })
    return jsonResponse({ ok: true, name: updated.name }, 200)
  } catch (err) {
    if (err instanceof SpaceError) {
      if (err.detail.kind === 'invalid') {
        return jsonResponse({ error: 'invalid_request', message: err.detail.message }, 400)
      }
      return jsonResponse({ error: 'space_not_found' }, 403)
    }
    throw err
  }
}

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  const body = await request.json().catch(() => null)
  return handlePatch({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    body,
    rename: renameSpace,
    db,
  })
}

export const GET: APIRoute = async () => jsonResponse({ error: 'method_not_allowed' }, 405)
export const POST: APIRoute = async () => jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () => jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () => jsonResponse({ error: 'method_not_allowed' }, 405)
