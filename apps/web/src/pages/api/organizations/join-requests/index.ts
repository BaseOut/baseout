/**
 * GET /api/organizations/join-requests
 *
 * Lists the active Organization's OPEN join requests for its owners/admins
 * (web-signup-domain-association task 2.3). Lazily expires past-window
 * pending rows first, so the list never shows stale requests.
 *
 * Middleware-gated; role check (owner|admin) enforced here server-side.
 */

import type { APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { organizationJoinRequests, users } from '../../../../db/schema'
import type { AccountContext } from '../../../../lib/account'
import { expireStaleJoinRequests } from '../../../../lib/signup/join-requests'
import type { AppDb } from '../../../../db'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface JoinRequestListItem {
  id: string
  requesterUserId: string
  requesterEmail: string
  requesterName: string
  domain: string | null
  createdAt: string
  expiresAt: string
}

export interface HandleGetInput {
  account: AccountContext | null
  expireStale: (organizationId: string) => Promise<number>
  listPending: (organizationId: string) => Promise<JoinRequestListItem[]>
}

const DECIDER_ROLES = new Set(['owner', 'admin'])

export async function handleGet(input: HandleGetInput): Promise<Response> {
  const orgId = input.account?.organization?.id
  if (!orgId) return jsonResponse({ error: 'Not authenticated' }, 401)
  if (!DECIDER_ROLES.has(input.account?.membership?.role ?? '')) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }
  await input.expireStale(orgId)
  const requests = await input.listPending(orgId)
  return jsonResponse({ ok: true, requests }, 200)
}

async function listPending(
  db: AppDb,
  organizationId: string,
): Promise<JoinRequestListItem[]> {
  const rows = await db
    .select({
      id: organizationJoinRequests.id,
      requesterUserId: organizationJoinRequests.requesterUserId,
      requesterEmail: users.email,
      requesterName: users.name,
      domain: organizationJoinRequests.domain,
      createdAt: organizationJoinRequests.createdAt,
      expiresAt: organizationJoinRequests.expiresAt,
    })
    .from(organizationJoinRequests)
    .innerJoin(users, eq(users.id, organizationJoinRequests.requesterUserId))
    .where(
      and(
        eq(organizationJoinRequests.organizationId, organizationId),
        eq(organizationJoinRequests.status, 'pending'),
      ),
    )
  return rows.map((r) => ({
    id: r.id,
    requesterUserId: r.requesterUserId,
    requesterEmail: r.requesterEmail,
    requesterName: r.requesterName,
    domain: r.domain,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  }))
}

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleGet({
    account: locals.account ?? null,
    expireStale: (organizationId) =>
      expireStaleJoinRequests(db, { organizationId }),
    listPending: (organizationId) => listPending(db, organizationId),
  })
}

export const POST: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
