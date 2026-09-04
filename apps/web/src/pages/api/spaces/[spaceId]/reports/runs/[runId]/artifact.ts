/**
 * /api/spaces/:spaceId/reports/runs/:runId/artifact?format=pdf|html  (GET)
 * Authorized artifact download — web verifies session + org membership, resolves
 * via the engine, and STREAMS the file. Artifact locations are never exposed to
 * an unauthorized caller. (web-reports-page task 2.2)
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine } from '../../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../../lib/account'
import {
  fetchSpaceById,
  guardReportsRequest,
  jsonResponse,
} from '../../../../../../../lib/reports/proxy'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ArtifactRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  runId: string | undefined
  format: string | null
  fetchSpace: (id: string) => Promise<{ id: string; organizationId: string } | null>
  engine: {
    getReportArtifact: (spaceId: string, runId: string, format: 'pdf' | 'html') => Promise<Response>
  } | null
}

export async function handleArtifact(input: ArtifactRouteInput): Promise<Response> {
  const guard = await guardReportsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
  })
  if (!guard.ok) return guard.response
  if (!input.runId || !UUID_RE.test(input.runId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (input.format !== 'pdf' && input.format !== 'html') {
    return jsonResponse({ error: 'invalid_request', message: 'format must be pdf|html' }, 400)
  }
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  // Stream the engine's response through, preserving status + content-type. The
  // engine returns JSON error bodies on 4xx/5xx; a 200 is the artifact bytes.
  const upstream = await input.engine.getReportArtifact(guard.space.id, input.runId, input.format)
  const contentType =
    upstream.headers.get('content-type') ??
    (input.format === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8')
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': contentType },
  })
}

function buildEngine() {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return {
    getReportArtifact: (spaceId: string, runId: string, format: 'pdf' | 'html') =>
      e.getReportArtifact(spaceId, runId, format),
  }
}

export const GET: APIRoute = async ({ locals, params, url }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleArtifact({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    runId: params.runId,
    format: url.searchParams.get('format'),
    fetchSpace: (id) => fetchSpaceById(db, id),
    engine: buildEngine(),
  })
}
