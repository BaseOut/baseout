/**
 * GET /api/onboarding/domain-association
 *
 * The join-or-create fork data for the signup flow
 * (web-signup-domain-association task 2.1). Returns the Organizations the
 * signed-in user's verified email domain resolves to (cap 3) plus any of
 * their open join requests, so /welcome can OFFER "request to join"
 * alongside "create my own account". Empty organizations ⇒ no fork — the
 * standard own-account path.
 *
 * Middleware-gated (session required). Exempt from the onboarding
 * (terms-accepted) gate in middleware.applyOnboardingGate — the fork is
 * shown DURING onboarding, before terms are accepted.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, eq, gt } from 'drizzle-orm'
import { resolveRuntimeEnv } from '../../../lib/runtime-env'
import { organizationJoinRequests, organizations } from '../../../db/schema'
import {
  resolveOrganizationsForEmail,
  type DomainAssociationResult,
} from '../../../lib/signup/domain-association'
import type { AppDb } from '../../../db'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface PendingJoinRequestView {
  id: string
  organizationId: string
  organizationName: string
  expiresAt: string
}

export interface HandleGetInput {
  user: { id: string; email: string } | null
  resolve: (email: string) => Promise<DomainAssociationResult>
  listOpenRequests: (userId: string) => Promise<PendingJoinRequestView[]>
}

export async function handleGet(input: HandleGetInput): Promise<Response> {
  if (!input.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const [{ domain, organizations: matches }, pendingRequests] =
    await Promise.all([
      input.resolve(input.user.email),
      input.listOpenRequests(input.user.id),
    ])
  return jsonResponse(
    { ok: true, domain, organizations: matches, pendingRequests },
    200,
  )
}

async function listOpenRequests(
  db: AppDb,
  userId: string,
): Promise<PendingJoinRequestView[]> {
  const rows = await db
    .select({
      id: organizationJoinRequests.id,
      organizationId: organizationJoinRequests.organizationId,
      organizationName: organizations.name,
      expiresAt: organizationJoinRequests.expiresAt,
    })
    .from(organizationJoinRequests)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationJoinRequests.organizationId),
    )
    .where(
      and(
        eq(organizationJoinRequests.requesterUserId, userId),
        eq(organizationJoinRequests.status, 'pending'),
        gt(organizationJoinRequests.expiresAt, new Date()),
      ),
    )
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    expiresAt: r.expiresAt.toISOString(),
  }))
}

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleGet({
    user: locals.user ? { id: locals.user.id, email: locals.user.email } : null,
    resolve: (email) =>
      resolveOrganizationsForEmail(
        db,
        email,
        resolveRuntimeEnv({
          BASEOUT_ENV: (env as { BASEOUT_ENV?: string }).BASEOUT_ENV,
          BASEOUT_DEV: (env as { BASEOUT_DEV?: string }).BASEOUT_DEV,
        }),
      ),
    listOpenRequests: (userId) => listOpenRequests(db, userId),
  })
}

export const POST: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
