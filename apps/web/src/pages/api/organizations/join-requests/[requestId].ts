/**
 * POST /api/organizations/join-requests/[requestId]   { action: 'approve' | 'decline' }
 *
 * Admin decision on a pending join request
 * (web-signup-domain-association task 2.3). Approve creates membership via
 * the existing team-member machinery and notifies the requester; decline
 * stamps the 30-day re-request cool-down. Both write audit rows (in
 * lib/signup/join-requests.ts).
 *
 * Middleware-gated; actor's owner/admin role on the request's org enforced
 * server-side inside decideJoinRequest.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  decideJoinRequest,
  type DecideJoinRequestResult,
} from '../../../../lib/signup/join-requests'
import { renderJoinRequestApprovedEmail } from '../../../../lib/email/templates/join-request'
import { sendEmail } from '../../../../lib/email/send'

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
  requestId: string | undefined
  body: unknown
  decide: (
    requestId: string,
    action: 'approve' | 'decline',
  ) => Promise<DecideJoinRequestResult>
  /** Fire-and-forget requester notification on approval. */
  notifyRequester: (input: {
    requesterEmail: string
    organizationName: string
  }) => Promise<void>
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  if (!input.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.requestId || !UUID_RE.test(input.requestId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const action =
    typeof input.body === 'object' &&
    input.body !== null &&
    ((input.body as Record<string, unknown>).action === 'approve' ||
      (input.body as Record<string, unknown>).action === 'decline')
      ? ((input.body as Record<string, unknown>).action as 'approve' | 'decline')
      : null
  if (!action) {
    return jsonResponse({ error: 'invalid_action' }, 400)
  }

  const result = await input.decide(input.requestId, action)
  if (!result.ok) {
    switch (result.reason) {
      case 'not_found':
        return jsonResponse({ error: 'not_found' }, 404)
      case 'not_admin':
        return jsonResponse({ error: 'forbidden' }, 403)
      case 'not_pending':
        return jsonResponse({ error: 'not_pending' }, 409)
      case 'expired':
        return jsonResponse({ error: 'expired' }, 410)
    }
  }

  if (result.status === 'approved' && result.requester.email) {
    try {
      await input.notifyRequester({
        requesterEmail: result.requester.email,
        organizationName: result.organization.name,
      })
    } catch {
      // Membership is already created; notification failure is non-fatal.
    }
  }

  return jsonResponse({ ok: true, status: result.status }, 200)
}

export const POST: APIRoute = async ({ request, params, locals }) => {
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
    requestId: params.requestId,
    body,
    decide: (requestId, action) =>
      decideJoinRequest(db, { requestId, actor: user!, action }),
    notifyRequester: async ({ requesterEmail, organizationName }) => {
      const rendered = renderJoinRequestApprovedEmail({ organizationName })
      await sendEmail(
        { to: requesterEmail, ...rendered },
        { email: env.EMAIL, from: env.EMAIL_FROM, dev: import.meta.env.DEV },
      )
    },
  })
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
