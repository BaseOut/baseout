/**
 * POST /api/spaces/:spaceId/restore
 *
 * Initiates a restore run from a prior backup:
 *   1. Authenticate via locals.account.
 *   2. IDOR-guard the Space against the authenticated org.
 *   3. Validate the request body (sourceRunId, scope, scopeTarget).
 *   4. Verify the source backup run exists in this Space and is restorable
 *      (status 'succeeded' or 'trial_succeeded').
 *   5. Resolve the Space's Airtable connection.
 *   6. INSERT a restore_runs row with status='queued', triggered_by='user_manual'.
 *   7. Call engine.startRestore(restoreId).
 *   8. Engine ok → return { restoreId }.
 *      Engine err → DELETE the orphaned row, return the engine code.
 *
 * Pattern mirrors the backup-runs POST: a testable inner handlePost(input,
 * deps) + a thin Astro APIRoute wrapper that wires real Drizzle + engine.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, desc, eq } from 'drizzle-orm'
import {
  backupRuns,
  connections,
  platforms,
  restoreRuns,
  spaces,
} from '../../../../db/schema'
import { createBackupEngine } from '../../../../lib/backup-engine'
import type {
  BackupEngineClient,
  EngineStartRestoreError,
  EngineStartRestoreResult,
} from '../../../../lib/backup-engine'
import type { AccountContext } from '../../../../lib/account'
import type { AppDb } from '../../../../db'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RESTORABLE_STATUSES = new Set(['succeeded', 'trial_succeeded'])

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Dependency types ─────────────────────────────────────────────────────

interface SpaceRow {
  id: string
  organizationId: string
}

interface ConnectionRow {
  id: string
  organizationId: string
  status: string
}

interface SourceRunRow {
  id: string
  spaceId: string
  status: string
}

export interface InsertRestoreRunInput {
  spaceId: string
  connectionId: string
  sourceRunId: string
  status: 'queued'
  scope: 'base' | 'table'
  scopeTarget: Record<string, unknown>
  triggeredBy: 'user_manual'
  isTrial: boolean
}

export interface HandlePostDeps {
  fetchSpaceById: (spaceId: string) => Promise<SpaceRow | null>
  fetchAirtableConnectionForOrg: (
    organizationId: string,
  ) => Promise<ConnectionRow | null>
  fetchSourceRun: (
    runId: string,
    spaceId: string,
  ) => Promise<SourceRunRow | null>
  insertRestoreRun: (input: InsertRestoreRunInput) => Promise<string>
  deleteRestoreRun: (restoreId: string) => Promise<void>
  engineStartRestore: (restoreId: string) => Promise<EngineStartRestoreResult>
}

// ── Body type ─────────────────────────────────────────────────────────────

interface RestoreBody {
  sourceRunId?: unknown
  scope?: unknown
  scopeTarget?: unknown
}

// ── Status mapper ─────────────────────────────────────────────────────────

function statusForRestoreEngineCode(
  code: EngineStartRestoreError['code'],
): number {
  switch (code) {
    case 'restore_not_found':
      return 404
    case 'restore_already_started':
      return 409
    case 'source_run_not_restorable':
      return 422
    case 'unauthorized':
      return 502
    case 'engine_unreachable':
      return 503
    case 'engine_error':
    default:
      return 502
  }
}

// ── Inner handler (testable) ──────────────────────────────────────────────

export interface HandlePostInput {
  account: AccountContext | null
  spaceId: string | undefined
  body: unknown
  deps: HandlePostDeps
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  // 1. Auth.
  if (!input.account?.organization?.id || !input.account?.user?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }

  // 2. UUID guard on spaceId.
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  // 3. Body validation.
  if (!input.body || typeof input.body !== 'object') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const b = input.body as RestoreBody

  const { sourceRunId, scope, scopeTarget } = b

  if (typeof sourceRunId !== 'string' || !UUID_RE.test(sourceRunId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (scope !== 'base' && scope !== 'table') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!scopeTarget || typeof scopeTarget !== 'object') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const st = scopeTarget as Record<string, unknown>
  if (typeof st.baseId !== 'string' || st.baseId.trim() === '') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (scope === 'table' && typeof st.tableId !== 'string') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  // 4. IDOR guard — 403 for both missing and cross-org.
  const space = await input.deps.fetchSpaceById(input.spaceId)
  if (!space) {
    return jsonResponse({ error: 'space_not_found' }, 403)
  }
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  // 5. Source run guard — must exist in this Space and be restorable.
  const sourceRun = await input.deps.fetchSourceRun(sourceRunId, input.spaceId)
  if (!sourceRun) {
    return jsonResponse({ error: 'source_run_not_found' }, 404)
  }
  if (!RESTORABLE_STATUSES.has(sourceRun.status)) {
    return jsonResponse({ error: 'source_run_not_restorable' }, 422)
  }

  // 6. Resolve Airtable connection.
  const connection = await input.deps.fetchAirtableConnectionForOrg(
    input.account.organization.id,
  )
  if (!connection) {
    return jsonResponse({ error: 'no_active_connection' }, 422)
  }

  // 7. INSERT the queued row.
  const restoreId = await input.deps.insertRestoreRun({
    spaceId: input.spaceId,
    connectionId: connection.id,
    sourceRunId,
    status: 'queued',
    scope,
    scopeTarget: st,
    triggeredBy: 'user_manual',
    isTrial: false,
  })

  // 8. Hand off to the engine.
  const engineResult = await input.deps.engineStartRestore(restoreId)
  if (engineResult.ok) {
    return jsonResponse({ restoreId: engineResult.restoreId }, 200)
  }

  // Engine rejected — delete the orphaned row. Swallow any DELETE failure.
  try {
    await input.deps.deleteRestoreRun(restoreId)
  } catch {
    // intentional — the engine error is the one to surface
  }

  return jsonResponse(
    { error: engineResult.code },
    statusForRestoreEngineCode(engineResult.code),
  )
}

// ── Astro APIRoute wrapper ────────────────────────────────────────────────

function buildEngine(): BackupEngineClient | null {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  return createBackupEngine({
    binding: env.BACKUP_ENGINE,
    internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
}

function buildDeps(db: AppDb, engine: BackupEngineClient): HandlePostDeps {
  return {
    fetchSpaceById: async (id) => {
      const [row] = await db
        .select({ id: spaces.id, organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, id))
        .limit(1)
      return (row as SpaceRow | undefined) ?? null
    },

    fetchAirtableConnectionForOrg: async (orgId) => {
      const [row] = await db
        .select({
          id: connections.id,
          organizationId: connections.organizationId,
          status: connections.status,
        })
        .from(connections)
        .innerJoin(platforms, eq(platforms.id, connections.platformId))
        .where(
          and(
            eq(connections.organizationId, orgId),
            eq(platforms.slug, 'airtable'),
            eq(connections.status, 'active'),
          ),
        )
        .orderBy(desc(connections.createdAt))
        .limit(1)
      return (row as ConnectionRow | undefined) ?? null
    },

    fetchSourceRun: async (runId, spaceId) => {
      const [row] = await db
        .select({
          id: backupRuns.id,
          spaceId: backupRuns.spaceId,
          status: backupRuns.status,
        })
        .from(backupRuns)
        .where(
          and(eq(backupRuns.id, runId), eq(backupRuns.spaceId, spaceId)),
        )
        .limit(1)
      return (row as SourceRunRow | undefined) ?? null
    },

    insertRestoreRun: async (insert) => {
      const [row] = await db
        .insert(restoreRuns)
        .values({
          spaceId: insert.spaceId,
          connectionId: insert.connectionId,
          sourceRunId: insert.sourceRunId,
          status: insert.status,
          scope: insert.scope,
          scopeTarget: insert.scopeTarget,
          triggeredBy: insert.triggeredBy,
          isTrial: insert.isTrial,
        })
        .returning({ id: restoreRuns.id })
      if (!row) throw new Error('insert_restore_run_returned_no_row')
      return row.id
    },

    deleteRestoreRun: async (id) => {
      await db.delete(restoreRuns).where(eq(restoreRuns.id, id))
    },

    engineStartRestore: (id) => engine.startRestore(id),
  }
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  const engine = buildEngine()
  if (!engine) {
    return jsonResponse(
      {
        error: 'server_misconfigured',
        message:
          'Backup engine binding or token is not configured. Contact support.',
      },
      503,
    )
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // invalid JSON — handlePost will reject with 400
  }

  return handlePost({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    body,
    deps: buildDeps(db, engine),
  })
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PATCH: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
