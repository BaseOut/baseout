/**
 * POST /api/internal/runs/start — STUB
 *
 * Spec: openspec/changes/baseout-web-run-now-contract/specs/web-run-now-contract/spec.md
 *
 * Until `baseout-server-engine-core` lands, this endpoint:
 *   1. Validates the `x-internal-token` header (constant-time compare).
 *   2. Validates the request body shape.
 *   3. Returns 501 with header `Spec: openspec/changes/baseout-web-run-now-contract`.
 *
 * The validating-stub pattern lets a server agent `curl` the endpoint to
 * exercise the contract end-to-end without any server-side code.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  constantTimeEqual,
  parseEnqueueRunRequest,
  type EnqueueRunErrorCode,
} from '../../../../lib/server-client'

const SPEC_PATH = 'openspec/changes/baseout-web-run-now-contract'

function errorResponse(
  code: EnqueueRunErrorCode,
  error: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ ok: false, code, error, spec: SPEC_PATH }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      Spec: SPEC_PATH,
      ...extraHeaders,
    },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const presented = request.headers.get('x-internal-token')
  const expected = (env as unknown as { BACKUP_ENGINE_INTERNAL_TOKEN?: string })
    .BACKUP_ENGINE_INTERNAL_TOKEN
  if (!presented || !expected) {
    return errorResponse('not_authenticated', 'Missing internal token', 401)
  }
  if (!constantTimeEqual(presented, expected)) {
    return errorResponse('not_authenticated', 'Invalid internal token', 401)
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return errorResponse('invalid_body', 'Body is not valid JSON', 400)
  }

  const parsed = parseEnqueueRunRequest(raw)
  if (!parsed.ok) {
    return errorResponse('invalid_body', parsed.error, 400)
  }

  return errorResponse(
    'not_yet_implemented',
    'Run enqueue is not yet implemented; see Spec header',
    501,
  )
}
