/**
 * POST /api/me/run-progress-token — STUB
 *
 * Spec: openspec/changes/baseout-web-websocket-progress-contract/specs/web-websocket-progress-contract/spec.md
 *
 * Will mint a one-time HMAC token that authorizes a WebSocket connection to
 * `wss://<server-host>/api/runs/<runId>/progress`. Until the live WSS endpoint
 * lands (`baseout-server-websocket-progress`), this returns 501 with the spec
 * header so callers / agents can curl it and see the contract.
 */

import type { APIRoute } from 'astro'

const SPEC_PATH = 'openspec/changes/baseout-web-websocket-progress-contract'

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      Spec: SPEC_PATH,
      ...extraHeaders,
    },
  })
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return jsonResponse({ ok: false, code: 'not_authenticated', error: 'Not authenticated', spec: SPEC_PATH }, 401)
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonResponse({ ok: false, code: 'invalid_body', error: 'Body is not valid JSON', spec: SPEC_PATH }, 400)
  }

  const body = (raw ?? {}) as Record<string, unknown>
  if (typeof body.runId !== 'string' || body.runId.length === 0) {
    return jsonResponse({ ok: false, code: 'invalid_body', error: 'runId must be a non-empty string', spec: SPEC_PATH }, 400)
  }

  return jsonResponse(
    {
      ok: false,
      code: 'not_yet_implemented',
      error: 'Token mint is not yet implemented; see Spec header',
      spec: SPEC_PATH,
    },
    501,
  )
}
