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

  const workerEnv = env as unknown as {
    BACKUP_ENGINE_URL?: string
    BACKUP_ENGINE_INTERNAL_TOKEN?: string
  }
  if (!workerEnv.BACKUP_ENGINE_URL || !workerEnv.BACKUP_ENGINE_INTERNAL_TOKEN) {
    return jsonResponse(
      {
        error: 'server_misconfigured',
        message:
          'Backup engine URL or token is not configured. Contact support.',
      },
      503,
    )
  }
  const engine = createBackupEngine({
    url: workerEnv.BACKUP_ENGINE_URL,
    internalToken: workerEnv.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
  const result = await engine.whoami(connectionId)
  if (result.ok) {
    return jsonResponse(
      { connectionId: result.connectionId, airtable: result.airtable },
      200,
    )
  }

  // Map engine error codes to a status the browser can act on. The route
  // returns the engine's HTTP status passthrough where it makes sense, so the
  // UI can show "Reconnect" vs "Try again" hints based on `code` alone.
  const responseStatus =
    result.code === 'connection_not_found'
      ? 404
      : result.code === 'invalid_connection_id'
        ? 400
        : result.code === 'connection_status'
          ? 409
          : result.code === 'server_misconfigured'
            ? 503
            : result.code === 'engine_unreachable'
              ? 503
              : 502
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
