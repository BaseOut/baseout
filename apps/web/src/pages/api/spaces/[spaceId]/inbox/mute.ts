/**
 * POST /api/spaces/:spaceId/inbox/mute
 *
 * Per-base mute proxy (web-notifications-inbox §5.1 / server-notifications-inbox):
 * `{ baseId, muted }` toggles a base's activity-lane rows out of the feed
 * (attention rows ignore mutes engine-side, by web-spec rule). Idempotent.
 * Authenticated + IDOR-guarded; the engine token never reaches the browser.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type MuteNotificationBaseResult,
} from '../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../lib/account'
import { inboxProxyStatus } from '../../../../../lib/inbox-feed'
import { fetchSpaceById, type SpaceRowForDocs } from '../../../../../lib/schema-docs/proxy'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface InboxMuteBody {
  baseId: string
  muted: boolean
}

/** Validate the client body. Null = reject with 400. */
export function parseMuteBody(body: unknown): InboxMuteBody | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.baseId !== 'string' || b.baseId.length === 0 || b.baseId.length > 128) return null
  if (typeof b.muted !== 'boolean') return null
  return { baseId: b.baseId, muted: b.muted }
}

export interface InboxMuteRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  body: unknown
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  engine:
    | ((spaceId: string, baseId: string, muted: boolean) => Promise<MuteNotificationBaseResult>)
    | null
}

export async function handleInboxMute(input: InboxMuteRouteInput): Promise<Response> {
  if (!input.account?.organization?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const space = await input.fetchSpace(input.spaceId)
  if (!space) return jsonResponse({ error: 'space_not_found' }, 403)
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }
  const parsed = parseMuteBody(input.body)
  if (!parsed) return jsonResponse({ error: 'invalid_request' }, 400)
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(space.id, parsed.baseId, parsed.muted)
  return r.ok
    ? jsonResponse({ ok: true }, 200)
    : jsonResponse({ error: r.code }, inboxProxyStatus(r))
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: InboxMuteRouteInput['engine'] = null
  if (env.SERVER && env.SERVER_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.SERVER,
      internalToken: env.SERVER_INTERNAL_TOKEN,
    })
    engine = (spaceId, baseId, muted) => e.muteNotificationBase(spaceId, baseId, muted)
  }
  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  return handleInboxMute({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    body,
    fetchSpace: (id) => fetchSpaceById(db, id),
    engine,
  })
}
