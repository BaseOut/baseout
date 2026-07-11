/**
 * POST /api/spaces/:spaceId/inbox/triage
 *
 * Triage proxy (web-notifications-inbox §5.1 / server-notifications-inbox):
 * persists read / unread / done / undone / snooze / unsnooze for one inbox
 * item. Body is validated SERVER-SIDE before it touches the engine; the
 * engine's 422 rejection of `done` on a state-backed id passes through.
 * Authenticated + IDOR-guarded; the engine token never reaches the browser.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type InboxTriageAction,
  type InboxTriageInput,
  type TriageNotificationResult,
} from '../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../lib/account'
import { inboxProxyStatus } from '../../../../../lib/inbox-feed'
import { fetchSpaceById, type SpaceRowForDocs } from '../../../../../lib/schema-docs/proxy'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ACTIONS: ReadonlySet<InboxTriageAction> = new Set([
  'read',
  'unread',
  'done',
  'undone',
  'snooze',
  'unsnooze',
])

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Validate + normalize the client body. Null = reject with 400. Item ids are
 * engine-composed (`conn:<id>` / `run:<id>` / `schema:<id>`) — opaque here,
 * but bounded so junk can't ride through to the engine.
 */
export function parseTriageBody(body: unknown): InboxTriageInput | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.itemId !== 'string' || b.itemId.length === 0 || b.itemId.length > 256) return null
  if (typeof b.action !== 'string' || !ACTIONS.has(b.action as InboxTriageAction)) return null
  const out: InboxTriageInput = { itemId: b.itemId, action: b.action as InboxTriageAction }
  if (b.snoozedUntil !== undefined && b.snoozedUntil !== null) {
    if (typeof b.snoozedUntil !== 'string' || Number.isNaN(Date.parse(b.snoozedUntil))) return null
    out.snoozedUntil = new Date(b.snoozedUntil).toISOString()
  }
  return out
}

export interface InboxTriageRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  body: unknown
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  engine:
    | ((spaceId: string, input: InboxTriageInput) => Promise<TriageNotificationResult>)
    | null
}

export async function handleInboxTriage(input: InboxTriageRouteInput): Promise<Response> {
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
  const parsed = parseTriageBody(input.body)
  if (!parsed) return jsonResponse({ error: 'invalid_request' }, 400)
  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const r = await input.engine(space.id, parsed)
  return r.ok
    ? jsonResponse({ ok: true }, 200)
    : jsonResponse({ error: r.code }, inboxProxyStatus(r))
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: InboxTriageRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, input) => e.triageNotification(spaceId, input)
  }
  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  return handleInboxTriage({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    body,
    fetchSpace: (id) => fetchSpaceById(db, id),
    engine,
  })
}
