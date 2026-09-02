/**
 * POST /api/onboarding/join-request   { organizationId }
 *
 * Creates a join request from the signed-in user to a known-domain
 * Organization (web-signup-domain-association task 2.3). Server-side
 * validation re-runs domain resolution — the client's offer list is UX,
 * not authorization. Org owners/admins are notified by email. The request
 * NEVER blocks the requester (suggest-never-auto-join); they continue in
 * their own account while it pends.
 *
 * Middleware-gated (session required); exempt from the onboarding gate —
 * see middleware.applyOnboardingGate.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createJoinRequest,
  type CreateJoinRequestResult,
} from '../../../lib/signup/join-requests'
import { renderJoinRequestAdminEmail } from '../../../lib/email/templates/join-request'
import { resolveRuntimeEnv } from '../../../lib/runtime-env'
import { sendEmail } from '../../../lib/email/send'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface HandlePostInput {
  user: { id: string; email: string } | null
  body: unknown
  create: (organizationId: string) => Promise<CreateJoinRequestResult>
  /** Fire-and-forget admin notification; failures never fail the request. */
  notifyAdmins: (input: {
    adminEmails: string[]
    organizationName: string
    requesterEmail: string
  }) => Promise<void>
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  if (!input.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const organizationId =
    typeof input.body === 'object' &&
    input.body !== null &&
    typeof (input.body as Record<string, unknown>).organizationId === 'string'
      ? ((input.body as Record<string, unknown>).organizationId as string)
      : null
  if (!organizationId || !UUID_RE.test(organizationId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const result = await input.create(organizationId)
  if (!result.ok) {
    switch (result.reason) {
      case 'domain_mismatch':
        return jsonResponse({ error: 'domain_mismatch' }, 403)
      case 'already_member':
        return jsonResponse({ error: 'already_member' }, 409)
      case 'pending_exists':
        return jsonResponse({ error: 'pending_exists' }, 409)
      case 'cooldown':
        return jsonResponse(
          { error: 'cooldown', until: result.until?.toISOString() ?? null },
          429,
        )
    }
  }

  try {
    await input.notifyAdmins({
      adminEmails: result.adminEmails,
      organizationName: result.organization.name,
      requesterEmail: input.user.email,
    })
  } catch {
    // Notification failure must not fail the request — the pending request
    // is also visible in the org's join-requests list.
  }

  return jsonResponse(
    {
      ok: true,
      requestId: result.requestId,
      organizationId: result.organization.id,
      expiresAt: result.expiresAt.toISOString(),
    },
    201,
  )
}

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const user = locals.user
    ? { id: locals.user.id, email: locals.user.email }
    : null

  return handlePost({
    user,
    body,
    create: (organizationId) =>
      createJoinRequest(db, {
        requester: user!,
        organizationId,
        runtimeEnv: resolveRuntimeEnv({
          BASEOUT_ENV: (env as { BASEOUT_ENV?: string }).BASEOUT_ENV,
          BASEOUT_DEV: (env as { BASEOUT_DEV?: string }).BASEOUT_DEV,
        }),
      }),
    notifyAdmins: async ({ adminEmails, organizationName, requesterEmail }) => {
      const rendered = renderJoinRequestAdminEmail({
        organizationName,
        requesterEmail,
      })
      const emailEnv = {
        email: env.EMAIL,
        from: env.EMAIL_FROM,
        dev: import.meta.env.DEV,
      }
      await Promise.all(
        adminEmails.map((to) => sendEmail({ to, ...rendered }, emailEnv)),
      )
    },
  })
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
