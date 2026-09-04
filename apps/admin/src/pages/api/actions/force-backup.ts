/**
 * POST /api/actions/force-backup — staff triggers a backup run for any
 * Space. Same run-start contract as web's startBackupRun (INSERT queued row
 * → engine /runs/:id/start → orphan DELETE on engine 4xx), with
 * `triggered_by='admin'` so staff-initiated runs stay identifiable. No
 * quota gate on this path (web's has none today either) — the audit
 * intent/result rows are the accountability mechanism.
 *
 * Auth: role='super' middleware gate. CSRF: same-origin + SameSite=Lax.
 * 503 server_misconfigured when the SERVER binding/token is absent.
 */

import type { APIRoute } from 'astro'
import { and, desc, eq, sql } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import {
  backupConfigurationBases,
  backupConfigurations,
  backupRuns,
  connections,
  platforms,
  spaces,
} from '../../../db/schema'
import { runAudited, type AuditDeps } from '../../../lib/audit'
import { buildAuditDeps } from '../../../lib/audit-db'
import { createAdminEngine } from '../../../lib/backup-engine'
import {
  forceBackup,
  type ForceBackupDeps,
  type ForceBackupResult,
} from '../../../lib/actions/force-backup'
import { checkOrigin } from '../../../lib/origin'
import { json, mapAuditFailure, methodNotAllowed, UUID_RE } from '../../../lib/actions/http'

const DOMAIN_REJECTIONS = new Set(['no_active_connection', 'invalid_connection', 'no_bases_selected'])

export interface HandleForceBackupInput {
  origin: string | null
  selfOrigin: string
  body: unknown
  actor: { id: string; email: string }
}

export interface HandleForceBackupDeps {
  fetchSpaceById: (spaceId: string) => Promise<{ id: string; organizationId: string } | null>
  backup: ForceBackupDeps
  /** False when the SERVER binding or internal token is missing. */
  engineConfigured: boolean
  audit: AuditDeps
}

export async function handlePost(
  input: HandleForceBackupInput,
  deps: HandleForceBackupDeps,
): Promise<Response> {
  if (!checkOrigin(input.origin, input.selfOrigin)) return json(403, { error: 'bad_origin' })

  const spaceId = (input.body as { spaceId?: unknown } | null)?.spaceId
  if (typeof spaceId !== 'string' || !UUID_RE.test(spaceId)) {
    return json(400, { error: 'invalid_request' })
  }

  if (!deps.engineConfigured) return json(503, { error: 'server_misconfigured' })

  // Precondition before auditing — a missing space doesn't pollute the trail.
  const space = await deps.fetchSpaceById(spaceId)
  if (!space) return json(404, { error: 'space_not_found' })

  const audited = await runAudited<ForceBackupResult>(
    {
      actor: input.actor,
      action: 'force_backup',
      targetType: 'space',
      targetId: space.id,
      organizationId: space.organizationId,
    },
    () => forceBackup(space, deps.backup),
    deps.audit,
  )

  const failure = mapAuditFailure(audited)
  if (failure) return failure
  if (!audited.ok) return json(500, { error: 'exception' }) // unreachable; narrows the type

  const value = audited.value
  if (value.ok) {
    return json(200, { ok: true, runId: value.runId, triggerRunIds: value.triggerRunIds })
  }
  if (DOMAIN_REJECTIONS.has(value.code)) return json(409, { error: value.code })
  return json(502, { error: value.code })
}

function buildDeps(locals: App.Locals): HandleForceBackupDeps {
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
    fetchSpaceById: async (spaceId) => {
      const rows = await db
        .select({ id: spaces.id, organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, spaceId))
        .limit(1)
      return rows[0] ?? null
    },
    backup: {
      fetchAirtableConnection: async (orgId) => {
        const rows = await db
          .select({ id: connections.id, status: connections.status })
          .from(connections)
          .innerJoin(platforms, eq(platforms.id, connections.platformId))
          .where(and(eq(connections.organizationId, orgId), eq(platforms.slug, 'airtable')))
          .orderBy(desc(connections.createdAt))
          .limit(1)
        return rows[0] ?? null
      },
      countIncludedBases: async (spaceId) => {
        const rows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(backupConfigurationBases)
          .innerJoin(
            backupConfigurations,
            eq(backupConfigurations.id, backupConfigurationBases.backupConfigurationId),
          )
          .where(
            and(
              eq(backupConfigurations.spaceId, spaceId),
              eq(backupConfigurationBases.isIncluded, true),
            ),
          )
        return rows[0]?.count ?? 0
      },
      insertBackupRun: async (insert) => {
        const inserted = await db
          .insert(backupRuns)
          .values({
            spaceId: insert.spaceId,
            connectionId: insert.connectionId,
            status: 'queued',
            triggeredBy: 'admin',
            isTrial: insert.isTrial,
          })
          .returning({ id: backupRuns.id })
        if (!inserted[0]) throw new Error('insert_backup_run_returned_no_row')
        return inserted[0].id
      },
      deleteBackupRun: async (runId) => {
        await db.delete(backupRuns).where(eq(backupRuns.id, runId))
      },
      engineStartRun: engine
        ? (runId) => engine.startRun(runId)
        : async () => ({ ok: false as const, code: 'engine_unreachable' as const, status: 0 }),
    },
    engineConfigured: engine !== null,
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
