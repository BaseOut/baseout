/**
 * POST /api/connections/airtable/test
 *
 * Authenticated probe — proves an Airtable Connection's stored token still
 * works. The browser POSTs `{ connection_id }`, this route:
 *   1. Verifies the connection belongs to the caller's active organization
 *      (IDOR guard — without this, any logged-in user could probe any other
 *      org's connections).
 *   2. Calls @baseout/server's POST /api/internal/connections/:id/whoami
 *      via the engine client. INTERNAL_TOKEN never reaches the browser.
 *   3. Maps the engine's typed result to a JSON response the browser can
 *      surface to the user.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import { connections } from '../../../../db/schema/core'
import { platforms } from '../../../../db/schema/core'
import { createBackupEngine } from '../../../../lib/backup-engine'
import { mapEngineCodeToStatus } from './_engine-status'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface RequestBody {
  connection_id?: unknown
}

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) return jsonResponse({ error: 'Not authenticated' }, 401)
  const account = locals.account
  if (!account?.organization) {
    return jsonResponse({ error: 'No active organization' }, 403)
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  const connectionId =
    typeof body.connection_id === 'string' ? body.connection_id : ''
  if (!UUID_RE.test(connectionId)) {
    return jsonResponse({ error: 'invalid_connection_id' }, 400)
  }

  // IDOR guard: only let the user probe connections in their active org.
  // Also restrict to airtable platform — this route is airtable-specific and
  // shouldn't surface other-platform connections.
  const rows = await locals.db
    .select({ id: connections.id })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(connections.id, connectionId),
        eq(connections.organizationId, account.organization.id),
        eq(platforms.slug, 'airtable'),
      ),
    )
    .limit(1)
  if (rows.length === 0) {
    return jsonResponse({ error: 'connection_not_found' }, 404)
  }

  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    return jsonResponse(
      {
        error: 'server_misconfigured',
        message:
          'Backup engine binding or token is not configured. Contact support.',
      },
      503,
    )
  }

  const engine = createBackupEngine({
    binding: env.BACKUP_ENGINE,
    internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
  const result = await engine.whoami(connectionId)

  // If Airtable rejected the stored token, flip the row to pending_reauth so
  // IntegrationsView's `needsReconnect` predicate flips true and the existing
  // Reconnect Airtable button surfaces on next render. The browser-side test
  // handler triggers a page reload on this code so the button appears without
  // a manual refresh. The cron-OAuth-refresh openspec change will eventually
  // do this proactively from the engine side; doing it here in the meantime
  // closes the UX gap.
  if (!result.ok && result.code === 'airtable_token_rejected') {
    await locals.db
      .update(connections)
      .set({ status: 'pending_reauth', modifiedAt: new Date() })
      .where(eq(connections.id, connectionId))
  }
  if (result.ok) {
    return jsonResponse(
      { connectionId: result.connectionId, airtable: result.airtable },
      200,
    )
  }

  // Map every engine error code to a status the browser can act on. The body's
  // `error` field is the stable contract the UI dispatches on (see
  // describeError() in IntegrationsView.astro). Status codes are chosen so
  // that 4xx = user can fix (reconnect), 5xx = operator/upstream problem.
  const responseStatus = mapEngineCodeToStatus(result.code)
  return jsonResponse(
    {
      error: result.code,
      upstream_status: result.status,
      ...(result.connectionStatus !== undefined && {
        connection_status: result.connectionStatus,
      }),
      ...(result.upstreamStatus !== undefined && {
        airtable_status: result.upstreamStatus,
      }),
    },
    responseStatus,
  )
}

