/**
 * POST /api/spaces/:spaceId/space-events/:eventId/dismiss
 *
 * Marks one space_events row as dismissed (sets dismissed_at = now()).
 * The IntegrationsView banner POSTs here when the user closes a
 * 'bases_discovered' card. The row is preserved in the DB for audit
 * — only the unread index filters on dismissed_at IS NULL.
 *
 * Mirror of the existing pattern: testable inner handlePost takes deps;
 * the Astro wrapper wires real Drizzle.
 */

import type { APIRoute } from 'astro'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { spaceEvents, spaces } from '../../../../../../db/schema'
import type { AccountContext } from '../../../../../../lib/account'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface SpaceRowSlim {
  id: string
  organizationId: string
}

export interface HandlePostInput {
  account: AccountContext | null
  spaceId: string | undefined
  eventId: string | undefined
  fetchSpaceById: (spaceId: string) => Promise<SpaceRowSlim | null>
  /** Update dismissed_at; returns the number of rows affected (0 or 1). */
  dismissEvent: (spaceId: string, eventId: string) => Promise<number>
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  if (!input.account?.organization?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!input.eventId || !UUID_RE.test(input.eventId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const space = await input.fetchSpaceById(input.spaceId)
  if (!space) {
    return jsonResponse({ error: 'space_not_found' }, 403)
  }
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  const affected = await input.dismissEvent(input.spaceId, input.eventId)
  if (affected === 0) {
    return jsonResponse({ error: 'event_not_found' }, 404)
  }
  return jsonResponse({ ok: true }, 200)
}

export const POST: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  return handlePost({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    eventId: params.eventId,
    fetchSpaceById: async (id) => {
      const [row] = await db
        .select({ id: spaces.id, organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, id))
        .limit(1)
      return (row as SpaceRowSlim | undefined) ?? null
    },
    dismissEvent: async (spaceId, eventId) => {
      const result = await db
        .update(spaceEvents)
        .set({ dismissedAt: sql`now()` })
        .where(
          and(
            eq(spaceEvents.id, eventId),
            eq(spaceEvents.spaceId, spaceId),
            isNull(spaceEvents.dismissedAt),
          ),
        )
        .returning({ id: spaceEvents.id })
      return result.length
    },
  })
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PATCH: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
