/**
 * GET /api/spaces/:spaceId/inbox
 *
 * Inbox feed proxy (web-notifications-inbox §5.1 / server-notifications-inbox).
 * Returns the engine-derived notification feed for one Space so the panel can
 * refresh client-side. Authenticated + IDOR-guarded (session account's org must
 * own the Space) — the engine token never reaches the browser.
 *
 * Same testable-inner-handler shape as backup-runs.ts: the wrapper wires real
 * Drizzle + the BACKUP_ENGINE binding; tests import handleInboxFeed with
 * vi.fn() deps.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type GetNotificationsResult } from '../../../../lib/backup-engine'
import type { AccountContext } from '../../../../lib/account'
import { inboxProxyStatus } from '../../../../lib/inbox-feed'
import { fetchSpaceById, type SpaceRowForDocs } from '../../../../lib/schema-docs/proxy'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface InboxFeedRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  engine: ((spaceId: string) => Promise<GetNotificationsResult>) | null
}

export async function handleInboxFeed(input: InboxFeedRouteInput): Promise<Response> {
  if (!input.account?.organization?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  // IDOR guard — 403 for both "doesn't exist" and "different org" prevents
  // probe-based enumeration (same shape as backup-runs).
  const space = await input.fetchSpace(input.spaceId)
  if (!space) return jsonResponse({ error: 'space_not_found' }, 403)
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(space.id)
  return r.ok
    ? jsonResponse({ ok: true, items: r.items }, 200)
    : jsonResponse({ error: r.code }, inboxProxyStatus(r))
}

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: InboxFeedRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId) => e.getNotifications(spaceId)
  }
  return handleInboxFeed({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    fetchSpace: (id) => fetchSpaceById(db, id),
    engine,
  })
}
