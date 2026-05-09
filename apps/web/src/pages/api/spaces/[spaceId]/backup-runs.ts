/**
 * POST + GET /api/spaces/:spaceId/backup-runs
 *
 * POST kicks off a manual backup run:
 *   1. Authenticate via locals.account.
 *   2. INSERT backup_runs in 'queued' state, fan out via the BACKUP_ENGINE
 *      service binding (delegates to startBackupRun in lib/backup-runs/start).
 *   3. On engine 4xx, the helper rolls back the orphaned row.
 *
 * GET lists the last N runs for the Space (default 10, max 100).
 *
 * Both handlers delegate to testable inner functions (handlePost / handleGet)
 * that take all dependencies as arguments — the route wrappers wire real
 * Drizzle queries + a real BackupEngineClient. Tests import the inner
 * handlers and pass vi.fn() deps; they never need to mock the
 * `cloudflare:workers` env import below.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, desc, eq, sql } from 'drizzle-orm'
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  backupRuns,
  connections,
  platforms,
  spaces,
} from '../../../../db/schema'
import { createBackupEngine } from '../../../../lib/backup-engine'
import type { BackupEngineClient } from '../../../../lib/backup-engine'
import type { AccountContext } from '../../../../lib/account'
import type { AppDb } from '../../../../db'
import { listRecentRuns } from '../../../../lib/backup-runs/list'
import type { BackupRunRowLike } from '../../../../lib/backup-runs/list'
import { startBackupRun } from '../../../../lib/backup-runs/start'
import type {
  StartBackupRunDeps,
  SpaceRow,
  ConnectionRow,
} from '../../../../lib/backup-runs/start'
import type {
  BackupRunsStartErrorCode,
  BackupRunSummary,
} from '../../../../lib/backup-runs/types'
import { mapEngineCodeToStatus } from '../../connections/airtable/_engine-status'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Map a BackupRunsStartError code to an HTTP status. apps/web-only codes
 * get hand-mapped; engine pass-through codes flow through the shared
 * mapEngineCodeToStatus helper.
 */
export function statusForStartCode(code: BackupRunsStartErrorCode): number {
  switch (code) {
    // apps/web-only — IDOR. 403 hides whether the space exists in another org.
    case 'space_not_found':
    case 'space_org_mismatch':
      return 403
    // apps/web-only — no Airtable connection at all.
    case 'no_active_connection':
      return 422
    // Engine pass-through — delegate to the shared map. mapEngineCodeToStatus
    // accepts both whoami and start-run codes (Phase 9.2 widening).
    case 'no_bases_selected':
    case 'unsupported_storage_type':
    case 'run_not_found':
    case 'config_not_found':
    case 'connection_not_found':
    case 'run_already_started':
    case 'invalid_connection':
    case 'unauthorized':
    case 'engine_unreachable':
    case 'engine_error':
      return mapEngineCodeToStatus(code)
  }
}

// ── POST handler ─────────────────────────────────────────────────────────

export interface HandlePostInput {
  account: AccountContext | null
  spaceId: string | undefined
  startDeps: StartBackupRunDeps
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  if (!input.account?.organization?.id || !input.account?.user?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const result = await startBackupRun(
    { spaceId: input.spaceId, organizationId: input.account.organization.id },
    input.startDeps,
  )

  if (result.ok) {
    return jsonResponse(
      { runId: result.runId, triggerRunIds: result.triggerRunIds },
      200,
    )
  }
  return jsonResponse({ error: result.code }, statusForStartCode(result.code))
}

// ── GET handler ──────────────────────────────────────────────────────────

export interface HandleGetInput {
  account: AccountContext | null
  spaceId: string | undefined
  limitParam: string | null
  fetchSpaceById: (spaceId: string) => Promise<SpaceRow | null>
  fetchRuns: (spaceId: string, limit: number) => Promise<BackupRunRowLike[]>
}

export async function handleGet(input: HandleGetInput): Promise<Response> {
  if (!input.account?.organization?.id || !input.account?.user?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  // Parse + clamp the limit. Default 10, max 100, min 1; non-numeric or
  // negative falls back to the default. Same shape the integrations
  // dashboard uses for its history call.
  const parsed = input.limitParam ? Number.parseInt(input.limitParam, 10) : NaN
  const limit = Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, MAX_LIMIT)
    : DEFAULT_LIMIT

  // IDOR guard — same shape as the POST helper. Returning 403 for both
  // "doesn't exist" and "different org" prevents probe-based enumeration.
  const space = await input.fetchSpaceById(input.spaceId)
  if (!space) {
    return jsonResponse({ error: 'space_not_found' }, 403)
  }
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  const runs: BackupRunSummary[] = await listRecentRuns(
    input.spaceId,
    limit,
    { fetchRuns: input.fetchRuns },
  )

  return jsonResponse({ runs }, 200)
}

// ── Astro APIRoute wrappers ──────────────────────────────────────────────
//
// Tiny adapters that wire real bindings to the handlers above. Tests import
// handlePost / handleGet directly and never touch this layer.

function buildEngine(): BackupEngineClient | null {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  return createBackupEngine({
    binding: env.BACKUP_ENGINE,
    internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
}

function buildStartDeps(
  db: AppDb,
  engine: BackupEngineClient,
): StartBackupRunDeps {
  return {
    fetchSpaceById: async (id) => {
      const [row] = await db
        .select({ id: spaces.id, organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, id))
        .limit(1)
      return (row as SpaceRow | undefined) ?? null
    },
    fetchAirtableConnection: async (orgId) => {
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
          ),
        )
        .orderBy(desc(connections.createdAt))
        .limit(1)
      return (row as ConnectionRow | undefined) ?? null
    },
    countIncludedBases: async (sid) => {
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(backupConfigurationBases)
        .innerJoin(
          backupConfigurations,
          eq(
            backupConfigurations.id,
            backupConfigurationBases.backupConfigurationId,
          ),
        )
        .where(
          and(
            eq(backupConfigurations.spaceId, sid),
            eq(backupConfigurationBases.isIncluded, true),
          ),
        )
      return Number(rows[0]?.count ?? 0)
    },
    insertBackupRun: async (insert) => {
      const [row] = await db
        .insert(backupRuns)
        .values({
          spaceId: insert.spaceId,
          connectionId: insert.connectionId,
          status: 'queued',
          triggeredBy: 'manual',
          isTrial: insert.isTrial,
        })
        .returning({ id: backupRuns.id })
      if (!row) throw new Error('insert_backup_run_returned_no_row')
      return row.id
    },
    deleteBackupRun: async (id) => {
      await db.delete(backupRuns).where(eq(backupRuns.id, id))
    },
    engineStartRun: (id) => engine.startRun(id),
  }
}

export const POST: APIRoute = async ({ locals, params }) => {
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
  return handlePost({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    startDeps: buildStartDeps(db, engine),
  })
}

export const GET: APIRoute = async ({ locals, params, url }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  return handleGet({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    limitParam: url.searchParams.get('limit'),
    fetchSpaceById: async (id) => {
      const [row] = await db
        .select({ id: spaces.id, organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, id))
        .limit(1)
      return (row as SpaceRow | undefined) ?? null
    },
    fetchRuns: async (sid, lim) => {
      const rows = await db
        .select({
          id: backupRuns.id,
          status: backupRuns.status,
          isTrial: backupRuns.isTrial,
          recordCount: backupRuns.recordCount,
          tableCount: backupRuns.tableCount,
          attachmentCount: backupRuns.attachmentCount,
          startedAt: backupRuns.startedAt,
          completedAt: backupRuns.completedAt,
          errorMessage: backupRuns.errorMessage,
          triggerRunIds: backupRuns.triggerRunIds,
          createdAt: backupRuns.createdAt,
        })
        .from(backupRuns)
        .where(eq(backupRuns.spaceId, sid))
        .orderBy(desc(backupRuns.createdAt))
        .limit(lim)
      return rows as BackupRunRowLike[]
    },
  })
}

// Astro auto-suppresses other methods, but explicitly returning 405 for
// PUT/DELETE/PATCH gives clearer diagnostics if someone hits the wrong verb.
export const PUT: APIRoute = async () => jsonResponse({ error: 'method_not_allowed' }, 405)
export const PATCH: APIRoute = async () => jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () => jsonResponse({ error: 'method_not_allowed' }, 405)

// Quiet TS6133 — atBases is reserved for the IDOR-safe space lookup
// extension if we ever need to surface base names in the GET response.
void atBases
