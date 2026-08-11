/**
 * POST /api/spaces/:spaceId/backup-runs/:runId/cancel
 *
 * User-driven cancel of an in-flight or queued backup run. The browser-side
 * Cancel button (BackupHistoryWidget) POSTs here; this route IDOR-guards
 * the (space, run) pair against the authenticated org, then forwards to
 * the engine's POST /api/internal/runs/:runId/cancel via the
 * BACKUP_ENGINE service binding.
 *
 * Pattern matches backup-runs.ts: a testable inner handlePost(input, deps)
 * pure function + a thin Astro APIRoute wrapper that wires real Drizzle +
 * BackupEngineClient. Tests import handlePost directly.
 *
 * Result-code → HTTP-status mapping:
 *   ok                          → 200  { ok: true, cancelledTriggerRunIds }
 *   not authenticated           → 401
 *   missing/invalid UUID input  → 400  { error: 'invalid_request' }
 *   space not in org / missing  → 403  IDOR — same status both, copy varies
 *   run not in space            → 404  { error: 'run_not_found' }
 *   engine pass-through:
 *     run_not_found             → 404
 *     run_already_terminal      → 409
 *     unauthorized (token)      → 502
 *     engine_unreachable        → 503
 *     engine_error              → 502
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import { backupRuns, spaces } from '../../../../../../db/schema'
import { createBackupEngine } from '../../../../../../lib/backup-engine'
import type {
  BackupEngineClient,
  EngineCancelRunResult,
} from '../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../lib/account'
import type { AppDb } from '../../../../../../db'
import { mapEngineCodeToStatus } from '../../../../connections/airtable/_engine-status'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface SpaceRow {
  id: string
  organizationId: string
}

interface RunRow {
  id: string
  spaceId: string
}

export interface HandlePostDeps {
  fetchSpaceById: (spaceId: string) => Promise<SpaceRow | null>
  fetchRunForSpace: (
    runId: string,
    spaceId: string,
  ) => Promise<RunRow | null>
  engineCancelRun: (runId: string) => Promise<EngineCancelRunResult>
}

export interface HandlePostInput {
  account: AccountContext | null
  spaceId: string | undefined
  runId: string | undefined
  deps: HandlePostDeps
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  // 1. Auth.
  if (!input.account?.organization?.id || !input.account?.user?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  // 2. UUID guard on both ids.
  if (
    !input.spaceId ||
    !UUID_RE.test(input.spaceId) ||
    !input.runId ||
    !UUID_RE.test(input.runId)
  ) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  // 3. IDOR guard: space must exist and belong to the authenticated org.
  //    Returning 403 for both "missing" and "different org" prevents
  //    probe-based enumeration (same shape as backup-runs.ts GET).
  const space = await input.deps.fetchSpaceById(input.spaceId)
  if (!space) {
    return jsonResponse({ error: 'space_not_found' }, 403)
  }
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  // 4. Run must belong to this Space. 404 — the run may exist under a
  //    different space within the same org, but a cancel POSTed at the
  //    wrong URL is still a bug from this surface's perspective.
  const run = await input.deps.fetchRunForSpace(input.runId, input.spaceId)
  if (!run) {
    return jsonResponse({ error: 'run_not_found' }, 404)
  }

  // 5. Forward to engine.
  const result = await input.deps.engineCancelRun(input.runId)
  if (result.ok) {
    return jsonResponse(
      { ok: true, cancelledTriggerRunIds: result.cancelledTriggerRunIds },
      200,
    )
  }
  return jsonResponse(
    { error: result.code },
    mapEngineCodeToStatus(result.code),
  )
}

// ── Astro APIRoute wrapper ──────────────────────────────────────────────

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
    fetchRunForSpace: async (runId, spaceId) => {
      const [row] = await db
        .select({ id: backupRuns.id, spaceId: backupRuns.spaceId })
        .from(backupRuns)
        .where(
          and(eq(backupRuns.id, runId), eq(backupRuns.spaceId, spaceId)),
        )
        .limit(1)
      return (row as RunRow | undefined) ?? null
    },
    engineCancelRun: (runId) => engine.cancelRun(runId),
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
    runId: params.runId,
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
