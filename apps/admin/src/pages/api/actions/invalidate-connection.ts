/**
 * POST /api/actions/invalidate-connection — staff marks a connection
 * `status='invalid'` (with `invalidated_at`) and best-effort cancels its
 * in-flight backup runs. The customer sees web's broken-connection banner
 * and new backups are refused until they reconnect. The 0015 Postgres
 * trigger on connections independently records the flip in
 * connection_status_audit, corroborating the admin_audit_log rows.
 *
 * Auth: role='super' middleware gate. CSRF: same-origin + SameSite=Lax.
 * Audit: intent row before the UPDATE, result row carries cancel outcomes.
 */

import type { APIRoute } from 'astro'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { backupRuns, connections } from '../../../db/schema'
import { runAudited, type AuditDeps } from '../../../lib/audit'
import { buildAuditDeps } from '../../../lib/audit-db'
import { createAdminEngine, type EngineCancelRunResult } from '../../../lib/backup-engine'
import {
  invalidateConnection,
  type InvalidateConnectionResult,
} from '../../../lib/actions/invalidate-connection'
import { checkOrigin } from '../../../lib/origin'
import { json, mapAuditFailure, methodNotAllowed, UUID_RE } from '../../../lib/actions/http'

export interface HandleInvalidateInput {
  origin: string | null
  selfOrigin: string
  body: unknown
  actor: { id: string; email: string }
}

export interface HandleInvalidateDeps {
  fetchConnectionById: (
    connectionId: string,
  ) => Promise<{ id: string; organizationId: string; status: string } | null>
  markConnectionInvalid: (connectionId: string) => Promise<void>
  fetchActiveRunIdsForConnection: (connectionId: string) => Promise<string[]>
  engineCancelRun: ((runId: string) => Promise<EngineCancelRunResult>) | null
  audit: AuditDeps
}

export async function handlePost(
  input: HandleInvalidateInput,
  deps: HandleInvalidateDeps,
): Promise<Response> {
  if (!checkOrigin(input.origin, input.selfOrigin)) return json(403, { error: 'bad_origin' })

  const connectionId = (input.body as { connectionId?: unknown } | null)?.connectionId
  if (typeof connectionId !== 'string' || !UUID_RE.test(connectionId)) {
    return json(400, { error: 'invalid_request' })
  }

  // Preconditions before auditing — rejections don't pollute the trail.
  const connection = await deps.fetchConnectionById(connectionId)
  if (!connection) return json(404, { error: 'connection_not_found' })
  if (connection.status === 'invalid') return json(409, { error: 'already_invalid' })

  const audited = await runAudited<InvalidateConnectionResult>(
    {
      actor: input.actor,
      action: 'invalidate_connection',
      targetType: 'connection',
      targetId: connectionId,
      organizationId: connection.organizationId,
      params: { previousStatus: connection.status },
    },
    () =>
      invalidateConnection(connectionId, {
        markConnectionInvalid: deps.markConnectionInvalid,
        fetchActiveRunIdsForConnection: deps.fetchActiveRunIdsForConnection,
        engineCancelRun: deps.engineCancelRun,
      }),
    deps.audit,
  )

  const failure = mapAuditFailure(audited)
  if (failure) return failure
  if (!audited.ok) return json(500, { error: 'exception' }) // unreachable; narrows the type

  return json(200, { ok: true, cancelledRuns: audited.value.cancelledRuns })
}

function buildDeps(locals: App.Locals): HandleInvalidateDeps {
  const db = locals.db
  const workerEnv = env as unknown as {
    SERVER?: { fetch: (input: string, init?: RequestInit) => Promise<Response> }
    SERVER_INTERNAL_TOKEN?: string
  }
  const engine = createAdminEngine({
    binding: workerEnv.SERVER,
    internalToken: workerEnv.SERVER_INTERNAL_TOKEN,
  })
  return {
    fetchConnectionById: async (connectionId) => {
      const rows = await db
        .select({
          id: connections.id,
          organizationId: connections.organizationId,
          status: connections.status,
        })
        .from(connections)
        .where(eq(connections.id, connectionId))
        .limit(1)
      return rows[0] ?? null
    },
    markConnectionInvalid: async (connectionId) => {
      const now = new Date().toISOString()
      await db
        .update(connections)
        .set({
          status: 'invalid',
          invalidatedAt: sql`${now}::timestamptz`,
          modifiedAt: sql`${now}::timestamptz`,
        })
        .where(eq(connections.id, connectionId))
    },
    fetchActiveRunIdsForConnection: async (connectionId) => {
      const rows = await db
        .select({ id: backupRuns.id })
        .from(backupRuns)
        .where(
          and(
            eq(backupRuns.connectionId, connectionId),
            inArray(backupRuns.status, ['queued', 'running']),
          ),
        )
      return rows.map((r) => r.id)
    },
    engineCancelRun: engine ? (runId) => engine.cancelRun(runId) : null,
    audit: buildAuditDeps(db),
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'invalid_request' })
  }
  return handlePost(
    {
      origin: request.headers.get('origin'),
      selfOrigin: new URL(request.url).origin,
      body,
      actor: { id: locals.user!.id, email: locals.user!.email },
    },
    buildDeps(locals),
  )
}

export const GET: APIRoute = () => methodNotAllowed()
export const PUT: APIRoute = () => methodNotAllowed()
export const PATCH: APIRoute = () => methodNotAllowed()
export const DELETE: APIRoute = () => methodNotAllowed()
