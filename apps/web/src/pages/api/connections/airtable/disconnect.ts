/**
 * POST /api/connections/airtable/disconnect
 *
 * User-initiated disconnect of the org's Airtable connection. Flips the row
 * into the existing `invalid` machinery (lib/airtable/disconnect.ts) — no row
 * deletion, backups history stays; the app-shell banner and /sources
 * "Reconnect" state take over, and re-Connect restores the same row. Backed-up
 * data is never touched.
 *
 * Auth rides the middleware session; the org is taken from locals.account —
 * no client-supplied ids (IDOR-safe by construction).
 */

import type { APIRoute } from 'astro'
import { disconnectAirtableConnection } from '../../../../lib/airtable/disconnect'
import type { AccountContext } from '../../../../lib/account'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface DisconnectDeps {
  account: AccountContext | null
  /** Performs the write; returns how many connections were flipped. */
  disconnect: (organizationId: string) => Promise<{ disconnected: number }>
}

export async function handlePost(deps: DisconnectDeps): Promise<Response> {
  const orgId = deps.account?.organization?.id
  if (!orgId) return json({ error: 'Not authenticated' }, 401)

  let disconnected: number
  try {
    ;({ disconnected } = await deps.disconnect(orgId))
  } catch {
    return json({ error: 'disconnect_failed' }, 502)
  }
  if (disconnected === 0) return json({ error: 'no_airtable_connection' }, 404)
  return json({ ok: true, disconnected }, 200)
}

export const POST: APIRoute = async ({ locals }) => {
  return handlePost({
    account: locals.account ?? null,
    disconnect: (orgId) => disconnectAirtableConnection(locals.db, orgId),
  })
}
